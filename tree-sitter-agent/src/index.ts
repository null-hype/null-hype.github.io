import { dag, Directory, object, func, Secret } from "@dagger.io/dagger"

@object()
export class TreeSitterAgent {
  /**
   * Generates a tree-sitter grammar based on a description using a free LLM via OpenRouter.
   */
  @func()
  async generate(
    description: string, 
    openrouterApiKey: Secret,
    model = "inclusionai/ling-2.6-flash:free"
  ): Promise<Directory> {
    const prompt = `You are a tree-sitter grammar expert. 
Generate a complete and valid grammar.js file for the following language description:
"${description}"

Return ONLY the code for grammar.js, without any markdown formatting or explanations.`;

    const body = JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }]
    });

    const response = await dag
      .container()
      .from("alpine:latest")
      .withExec(["apk", "add", "curl"])
      .withMountedSecret("/tmp/key", openrouterApiKey)
      .withNewFile("/tmp/body.json", body)
      .withExec([
        "sh", "-c",
        "CLEAN_KEY=$(cat /tmp/key | tr -d '[:space:]'); " +
        "curl -s -X POST https://openrouter.ai/api/v1/chat/completions " +
        "-H \"Content-Type: application/json\" " +
        "-H \"Authorization: Bearer $CLEAN_KEY\" " +
        "-d @/tmp/body.json"
      ])
      .stdout();

    const grammarContent = await dag
      .container()
      .from("alpine:latest")
      .withExec(["apk", "add", "jq"])
      .withExec([
        "sh", "-c", 
        `echo '${response.replace(/'/g, "'\\''")}' | jq -r '.choices[0].message.content'`
      ])
      .stdout();

    if (grammarContent.trim() === "null" || grammarContent.trim() === "") {
        throw new Error(`Failed to generate grammar. API Response: ${response}`);
    }

    let cleanedContent = grammarContent.trim();
    if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "");
    }

    return dag.directory().withNewFile("grammar.js", cleanedContent);
  }

  /**
   * Validates a tree-sitter grammar by running 'tree-sitter generate'.
   */
  @func()
  async validate(grammarDir: Directory): Promise<string> {
    return dag
      .container()
      .from("alpine:latest")
      .withExec(["apk", "add", "--no-cache", "tree-sitter-cli", "nodejs", "npm"])
      .withMountedDirectory("/src", grammarDir)
      .withWorkdir("/src")
      .withExec(["sh", "-c", "echo '{\"name\": \"test-grammar\"}' > package.json"])
      .withExec(["tree-sitter", "generate"])
      .stdout();
  }
}
