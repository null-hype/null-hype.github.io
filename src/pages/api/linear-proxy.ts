import type { APIRoute } from 'astro';

export const prerender = false;

const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

export const POST: APIRoute = async ({ request }) => {
	console.log('Proxying request to Linear API...');
	const apiKey = import.meta.env.LINEAR_API_KEY;

	if (!apiKey) {
		console.error('LINEAR_API_KEY is not configured on the server.');
		return new Response(
			JSON.stringify({ error: 'LINEAR_API_KEY is not configured on the server.' }),
			{ status: 500, headers: { 'content-type': 'application/json' } }
		);
	}

	console.log(`Using API Key starting with: ${apiKey.substring(0, 10)}...`);

	try {
		const body = await request.text();
		const response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'authorization': apiKey,
			},
			body,
		});

		const data = await response.json();
		console.log(`Linear API responded with status: ${response.status}`);
		console.error('Linear API Response Body:', JSON.stringify(data, null, 2));
		
		if (response.status >= 400) {
			console.error('Linear API Error Data:', JSON.stringify(data, null, 2));
		}

		if (data.data?.customView) {
			const issueCount = data.data.customView.issues?.nodes?.length ?? 0;
			console.log(`Custom View: ${data.data.customView.name}, Issues: ${issueCount}`);
		} else if (data.errors) {
			console.error('Linear GraphQL Errors:', JSON.stringify(data.errors, null, 2));
		}

		return new Response(JSON.stringify(data), {
			status: response.status,
			headers: {
				'content-type': 'application/json',
			},
		});
	} catch (error) {
		console.error('Linear proxy error:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to proxy request to Linear API.' }),
			{ status: 500, headers: { 'content-type': 'application/json' } }
		);
	}
};
