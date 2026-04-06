export const identityDossierContent = {
	masthead: 'Identity Sync // Richard Anthony',
	reference: 'Linear: PLAN-237 // @public-rant',
	headline: 'Security Researcher & Platform Engineer | Agentic Vulnerability Automation | Terraform · ArgoCD · GitOps | Bug Bounty',
	about: [
		'I build things that break things — systematically and at scale.',
		"Over the past several years I've moved from shipping production web applications at Bloomberg and XO Group into designing agentic security automation platforms — pipelines that can enumerate, scan, and exploit attack surfaces without manual intervention. My current focus is on building out \"Cyber Farm\" infrastructure: a distributed, GitOps-managed environment using Terraform, ArgoCD, and Dagger to orchestrate automated vulnerability research workflows across multiple targets simultaneously.",
		"My background spans full-stack engineering (Node.js, Ruby, Shell), test automation, and platform architecture — which means I approach security differently: I don't just run tools, I build and extend them. I'm particularly interested in web application security, API attack surfaces, and the automation of reconnaissance and reporting pipelines.",
		'I hold German at C1 level and have worked in Berlin, New York, and Sydney, which positions me well for both Australian and DACH-market security roles.'
	],
	experience: [
		{
			role: 'Freelance Software Engineer',
			period: 'Jan 2021 – Present',
			bullets: [
				'Designing and deploying "Cyber Farm" — an agentic vulnerability research platform.',
				'Orchestrating automated bug bounty recon pipelines using Terraform, ArgoCD, and Dagger.',
				'Building custom security tooling and automated exfiltration frameworks.'
			]
		},
		{
			role: 'Freelance Software Engineer',
			location: 'Berlin, Germany',
			period: '2018 – 2019',
			description: 'Technical contract work focused on the DACH-market, delivered in a German-speaking environment.'
		},
		{
			role: 'Software Engineer',
			company: 'Bloomberg LP / XO Group',
			description: 'Shipped production web applications at global scale.'
		}
	],
	projects: [
		{
			title: 'Cyber Farm',
			subtitle: 'Agentic Vulnerability Research Platform',
			description: 'A distributed infrastructure for automated reconnaissance and exploit validation.'
		},
		{
			title: 'Automated Recon Pipeline',
			subtitle: 'Bug Bounty Automation',
			description: 'GitOps-managed pipeline for continuous attack surface monitoring.'
		}
	],
	skills: {
		add: ['Terraform', 'ArgoCD', 'Dagger', 'GitOps', 'Kubernetes', 'Docker', 'Penetration Testing', 'Vulnerability Research', 'Bug Bounty Hunting', 'OWASP', 'Burp Suite', 'Nmap/Masscan'],
		remove: ['AngularJS', 'Capistrano', 'RSpec', 'Ruby on Rails', 'UAT', 'UX']
	},
	languages: [
		{ name: 'English', level: 'Native' },
		{ name: 'German', level: 'C1' }
	]
};
