import { describe, expect, it } from "vitest"

import { buildPrompt, buildPromptForAgent } from "@/services/prompt-builder"
import type { Skill } from "@/types"

const skill = (name: string): Skill => ({
  id: name,
  name,
  description: "",
  directoryPath: `/tmp/${name}`,
  skillFilePath: `/tmp/${name}/SKILL.md`,
  tags: [],
  source: "test",
  isValid: true,
  validationErrors: [],
  preview: "",
})

describe("buildPrompt", () => {
  it("returns the task when no skills are selected", () => {
    expect(buildPrompt([], "  write tests  ")).toBe("write tests")
  })

  it("deduplicates skill calls and prefixes the task by default", () => {
    expect(buildPrompt([skill("frontend-design"), skill("frontend-design"), skill("shadcn")], "ship it"))
      .toBe("$frontend-design $shadcn\n\nship it")
  })

  it("supports suffix insertion", () => {
    expect(buildPrompt([skill("frontend-design")], "ship it", "suffix"))
      .toBe("ship it\n\n$frontend-design")
  })

  it("does not emit unsafe command names", () => {
    expect(buildPrompt([skill("bad/name"), skill("ok-name")], "ship it"))
      .toBe("$ok-name\n\nship it")
  })

  it("uses a safe bundle alias for a selected Skill", () => {
    expect(buildPrompt([skill("frontend-design")], "ship it", "prefix", { "frontend-design": "ui-console" }))
      .toBe("$ui-console\n\nship it")
  })

  it.each([
    ["codex", "$frontend-design\n\nship it"],
    ["claude", "/frontend-design\n\nship it"],
    ["cursor", "/frontend-design\n\nship it"],
    ["opencode", "Use the OpenCode skill tool to load: frontend-design\n\nship it"],
  ] as const)("uses the native %s invocation format", (agentId, expected) => {
    expect(buildPromptForAgent(agentId, [skill("frontend-design")], "ship it")).toBe(expected)
  })
})
