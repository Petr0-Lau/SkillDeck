import type { AgentId, Skill } from "@/types"

const safeCommandName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const emptyCommandNames: Record<string, string> = {}

export function buildPrompt(skills: Skill[], task: string, insertionMode = "prefix", commandNames = emptyCommandNames) {
  const commands = [...new Set(skills.map((skill) => (commandNames[skill.id] ?? skill.name).trim()))].filter((name) =>
    safeCommandName.test(name),
  )
  const invocation = commands.map((name) => `$${name}`).join(" ")
  const cleanTask = task.trim()

  if (!invocation) return cleanTask
  if (!cleanTask) return invocation
  return insertionMode === "suffix"
    ? `${cleanTask}\n\n${invocation}`
    : `${invocation}\n\n${cleanTask}`
}

export function buildAgentInvocation(agentId: AgentId, commands: string[]) {
  if (agentId === "opencode") {
    return `Use the OpenCode skill tool to load: ${commands.join(", ")}`
  }
  const prefix = agentId === "codex" ? "$" : "/"
  return commands.map((name) => `${prefix}${name}`).join(" ")
}

export function buildPromptForAgent(
  agentId: AgentId,
  skills: Skill[],
  task: string,
  insertionMode = "prefix",
  commandNames = emptyCommandNames,
) {
  const commands = [...new Set(skills.map((skill) => (commandNames[skill.id] ?? skill.name).trim()))].filter((name) =>
    safeCommandName.test(name),
  )
  const invocation = buildAgentInvocation(agentId, commands)
  const cleanTask = task.trim()

  if (!invocation) return cleanTask
  if (!cleanTask) return invocation
  return insertionMode === "suffix"
    ? `${cleanTask}\n\n${invocation}`
    : `${invocation}\n\n${cleanTask}`
}

export function buildCommandPreview(
  skills: Skill[],
  task: string,
  insertionMode = "prefix",
  commandNames = emptyCommandNames,
  agentId: AgentId = "codex",
  emptyPreview = `Select a skill and add a task to preview the ${agentId} input.`,
) {
  const prompt = buildPromptForAgent(agentId, skills, task, insertionMode, commandNames)
  return prompt || emptyPreview
}
