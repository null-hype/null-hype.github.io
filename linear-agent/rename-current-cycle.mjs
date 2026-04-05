const DEFAULT_NAME = 'Signal Window';
const GRAPHQL_ENDPOINT = process.env.LINEAR_GRAPHQL_ENDPOINT ?? 'https://api.linear.app/graphql';

const ACTIVE_CYCLES_QUERY = `
  query ActiveCycles {
    cycles(filter: { isActive: { eq: true } }, first: 10) {
      nodes {
        id
        number
        name
        startsAt
        endsAt
        team {
          id
          name
        }
      }
    }
  }
`;

const CYCLE_UPDATE_MUTATION = `
  mutation RenameCycle($id: String!, $input: CycleUpdateInput!) {
    cycleUpdate(id: $id, input: $input) {
      success
      cycle {
        id
        number
        name
        startsAt
        endsAt
        team {
          id
          name
        }
      }
    }
  }
`;

function parseName(argv) {
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === '--name') {
      return args[index + 1] ?? '';
    }

    if (value.startsWith('--name=')) {
      return value.slice('--name='.length);
    }
  }

  return args.join(' ').trim();
}

async function postGraphql(apiKey, body) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok || json.errors?.length) {
    const details = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`);
  }

  return json.data;
}

async function main() {
  const apiKey = process.env.LINEAR_API_KEY ?? '';

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY is required');
  }

  const requestedName = parseName(process.argv);
  const nextName = requestedName || DEFAULT_NAME;

  const activeCyclesData = await postGraphql(apiKey, { query: ACTIVE_CYCLES_QUERY });
  const activeCycles = activeCyclesData.cycles?.nodes ?? [];

  if (activeCycles.length !== 1) {
    throw new Error(
      `Expected exactly one active cycle, found ${activeCycles.length}: ${JSON.stringify(activeCycles, null, 2)}`,
    );
  }

  const [currentCycle] = activeCycles;

  const updateData = await postGraphql(apiKey, {
    query: CYCLE_UPDATE_MUTATION,
    variables: {
      id: currentCycle.id,
      input: {
        name: nextName,
      },
    },
  });

  const result = updateData.cycleUpdate;

  if (!result?.success || !result.cycle) {
    throw new Error(`Cycle update did not succeed: ${JSON.stringify(result, null, 2)}`);
  }

  console.log(
    JSON.stringify(
      {
        previousName: currentCycle.name,
        updatedCycle: result.cycle,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
