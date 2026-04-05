module github.com/null-hype/tidelane-infra/test

go 1.22

require (
	github.com/gruntwork-io/terratest v0.46.7
	github.com/stretchr/testify v1.9.0
)

// Run `go mod tidy` inside infra/test/ after cloning to generate go.sum.
// The Dagger check function runs this automatically before go test.
