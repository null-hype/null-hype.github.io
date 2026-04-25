---
type: lesson
title: Introduction to Grammar as Protocol
template: default
focus: /exercise.de
---

# Grammar as Protocol

What if natural language was treated with the same rigor as source code? 

In this lesson, we explore the concept of **Grammar as Protocol**. Instead of viewing a German sentence as a mere string of characters, we treat it as a **Typed Object** that must adhere to a formal schema.

## The Dative Constraint

In German, certain verbs (like *helfen*) take a "Dative" object. If you use an "Accusative" object instead, the sentence doesn't just sound "wrong"—it **violates the protocol**.

### The Task
Look at the editor on the right. You'll see the sentence:
`Ich helfe meinen Bruder.`

This sentence contains a type error. The verb `helfen` is defined in our grammar as requiring a Dative object. `meinen Bruder` is Accusative.

1.  **Hover** over the word `meinen` in the editor.
2.  See the **LSP Diagnostic** explaining the dative requirement.
3.  Fix the sentence by changing `meinen` to `meinem`.

### Formal Verification
Note the `GermanGrammar.pkl` file in the sidebar. That is our **Source of Truth**. It defines the "Types" of German verbs. By changing that file, you would change the rules of the language itself.
