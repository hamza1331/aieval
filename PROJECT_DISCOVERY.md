# PROJECT_DISCOVERY

## 1. Executive Summary

The original idea — an “LLM evaluation toolkit” broadly described as a general-purpose agent evaluation system — is directionally promising, but too broad to be a credible v0.1 project without becoming another platform-like abstraction. The research strongly suggests the more valuable and differentiated opportunity is a TypeScript-first runtime validation and reliability toolkit for AI applications that focuses on deterministic checks, structured-output validation, and failure classification before optional LLM-as-a-judge scoring is used.

This is not the same as building a full AI observability platform or another generic evaluation framework. The gap is narrower and more defensible:

- Most existing ecosystems are either observability platforms (Langfuse, LangSmith, OpenTelemetry, Phoenix), or broad evaluation frameworks with a heavy emphasis on LLM-as-a-judge and datasets (Ragas, DeepEval, Promptfoo, LangSmith evaluation tooling).
- Many guardrail libraries exist, but they are mostly Python-first and oriented around policy enforcement, schema validation, and single-purpose validators.
- TypeScript developers building production AI apps still lack a small, composable, deterministic validation toolkit that works in plain Node/TypeScript code without requiring a hosted platform, a cloud service, or a framework-specific runtime.

The strongest direction is a library that helps developers define and run reliability checks on LLM outputs and agent tool usage before those outputs are accepted or repaired. It is a “runtime safety + evaluation” toolkit, not a general AI framework.

The recommended project is intentionally narrow and opinionated:

- deterministic validation first,
- optional LLM-based scoring second,
- agent/tool-call validation as a focused extension,
- no hosted dashboard in v0.1,
- no assumption that a full evaluation platform is necessary,
- strong TypeScript ergonomics and modular package design.

---

## 2. Problem Space

The core problem is not simply “how do I score an LLM response?” It is: “how do I reliably detect predictable AI failure modes in production before they reach users, before a tool call runs, or before a workflow continues?”

The most important failure modes in real AI systems include:

- structured output drift or invalid JSON schema
- missing, extra, or malformed fields
- enum or type mismatches
- unsupported or out-of-domain claims
- unsupported tool calls or invalid arguments
- context mismatch or contradictory answers
- citation or evidence gaps
- prompt regression across versions
- LLM output not matching a business policy
- inconsistent outputs across retries and re-runs
- multi-step agent loops that drift from the intended action graph
- hidden latency, cost, and quality regressions in production

This problem is larger than a single validator library because production AI reliability is a system issue:

- model behavior is probabilistic,
- tool execution creates side effects,
- prompts change over time,
- business policies evolve,
- agent workflows become long-running and hard to debug,
- deterministic checks can be cheap and trustworthy,
- LLM-based judges are useful but not always appropriate.

The practical pain points are:

1. Developers ask for “evals,” but what they really need is a way to detect and prevent obvious failures cheaply and deterministically.
2. LLM-as-a-judge is useful for ambiguous semantic comparisons, but it is slow, expensive, and non-deterministic.
3. Schema validation alone is insufficient because many business failures are semantic, not syntactic.
4. Tool-call validation and action guardrails are under-served in TypeScript ecosystems.
5. Regression testing for prompts and agent strategies is not well packaged in a developer-friendly runtime library.
6. Production AI teams need traceability, but they also need a small set of “assertions” they can run before operations proceed.

---

## 3. Existing Ecosystem

### 3.1 LangChain & LangGraph

What it does:
- LangChain provides abstractions for model calls, prompts, tools, retrieval, and chains.
- LangGraph provides graph-based orchestration for agent flows.

Who it is for:
- Application developers building LLM pipelines and agentic applications.

Architecture:
- Flexible frameworks with many integrations and abstractions.
- Not primarily a deterministic validation library.

Strengths:
- broad ecosystem coverage
- strong multi-step workflow support
- good for orchestration and tool integration

Weaknesses:
- not optimized as a “pre-flight validator” or local runtime assertion toolkit
- often requires deeper framework coupling
- evaluation is not the primary design center

Overlap:
- can integrate with our toolkit to validate outputs and tool calls around LangChain/LangGraph flows.

What it does not solve:
- a small, TypeScript-native, deterministic reliability layer with a clean validation API and composable failure model.

Recommendation:
- integrate as an adapter ecosystem, not compete directly.

### 3.2 LangSmith

What it does:
- tracing, benchmark datasets, evals, prompts, feedback loops, experimentation, and production monitoring.

Who it is for:
- teams running larger LLM workloads and wanting platform-level evaluation infrastructure.

Architecture:
- hosted or managed service with SDKs and platform workflows.

Strengths:
- mature platform story
- broad evaluation features
- deep tracing and observability integration

Weaknesses:
- not a lightweight local library for deterministic checks
- more overhead and cloud/cross-team process than many projects need
- less useful as a minimal OSS library for one developer or one service

Overlap:
- our project should not mimic a hosted evaluation platform.

What it does not solve:
- a drop-in validation guard in pure TypeScript without platform coupling.

Recommendation:
- integrate optionally for exported traces or results, but not as a dependency for the core library.

### 3.3 Langfuse

What it does:
- observability, tracing, prompt management, experiments, and evaluations.

Who it is for:
- teams needing an end-to-end AI engineering platform for production debugging and quality monitoring.

Architecture:
- open-source platform plus SDKs and APIs.

Strengths:
- excellent observability and lineage
- strong production instrumentation capabilities
- prompt management and experiment workflows

Weaknesses:
- not designed as a simple runtime validation primitive for TypeScript services
- more operational footprint than a lightweight library

Overlap:
- could be an integration target for exporting evaluation results or traces.

What it does not solve:
- “cheap, deterministic failure detection right before a tool call or output is accepted.”

Recommendation:
- complementary, not competitive.

### 3.4 Ragas

What it does:
- measures and experiments for LLM applications, with a focus on data-driven evaluation loops and LLM-based metrics.

Who it is for:
- evaluation-heavy teams and researchers.

Architecture:
- Python-first library with dataset/experiment concepts and metric composition.

Strengths:
- thoughtful evaluation-loop model
- strong emphasis on experiments and metric design
- good for repeated improvement and benchmark-driven optimization

Weaknesses:
- less focused on runtime guardrails or deterministic validation
- not naturally a TypeScript/Node library for service-level checks
- broad evaluation abstractions can become “framework-like”

Overlap:
- our idea intersects on evaluation and regression workflows, but not with the same design center.

Recommendation:
- reference for evaluation loop thinking, not a direct competitor.

### 3.5 DeepEval / other Python eval frameworks

What it does:
- custom evaluation metrics, tests, and model benchmark pipelines.

Who it is for:
- Python-first ML/AI engineering teams.

Architecture:
- metrics + test runner + evaluation DSL.

Strengths:
- robust metric-driven evaluation thinking
- mature for benchmarking and model comparisons

Weaknesses:
- often Python-centric and less aligned with TypeScript service engineering
- not optimized for runtime enforcement in production code paths
- not a minimal library targeting a single Node service

Recommendation:
- learn from their metrics philosophy; do not duplicate their platform complexity.

### 3.6 Guardrails AI

What it does:
- input/output validation guards for LLM apps with validators and structured-output generation.

Who it is for:
- Python developers building LLM apps requiring runtime validation and schema enforcement.

Architecture:
- validator framework with guard patterns and policy-based validation.

Strengths:
- very strong conceptually for runtime validation
- real emphasis on practical risk mitigation
- useful guard patterns for enforcing rules on outputs

Weaknesses:
- Python-first; less natural for TypeScript-first teams
- more “framework” feel than minimal library
- heavy on validators and guard definitions; not as elegant for Node service architecture patterns

Overlap:
- very close in spirit to the recommended direction, especially for guard validation and deterministic checks.

What it does not solve:
- TypeScript-native API ergonomics and repository simplicity for modern Node services
- a modular runtime library that does not depend on Python or a proprietary server model

Recommendation:
- use as a conceptual reference and design inspiration, but do not clone its full architecture.

### 3.7 OpenTelemetry

What it does:
- vendor-neutral observability instrumentation, metrics, traces, logs.

Who it is for:
- platform and infra engineers; observability teams.

Architecture:
- standard instrumentation model.

Strengths:
- standard, battle-tested telemetry model
- excellent for production monitoring and correlations

Weaknesses:
- instrumentation is not evaluation logic
- not a validation or repair system

Overlap:
- relevant if our project wants to attach evaluation results to traces or metrics.

Recommendation:
- integration point, not a core dependency.

### 3.8 Phoenix / Arize

What it does:
- observability and evaluation for LLM apps.

Who it is for:
- teams that want a richer platform for tracing and quality analysis.

Strengths:
- strong observability and quality dashboards
- useful for production AI troubleshooting

Weaknesses:
- again, not a focused TypeScript runtime validation library
- heavier platform footprint

Recommendation:
- complementary, not core.

### 3.9 Promptfoo

What it does:
- evaluation and experimentation for prompts and models.

Who it is for:
- teams doing prompt and model regression testing.

Architecture:
- CLI/test runner for evaluation datasets and experiments.

Strengths:
- excellent for regression-based prompt testing
- practical developer workflow

Weaknesses:
- not a runtime validation library for application code paths
- CLI-first focus may not fit a TypeScript library storyline as well

Recommendation:
- learn from its testing methodology, but keep our project smaller and more runtime-oriented.

---

## 4. Competitive / Open Source Landscape

The open-source landscape is crowded in the following ways:

- Observability + evaluation platforms: LangSmith, Langfuse, Phoenix, Arize
- Guardrail libraries: Guardrails AI and a class of Python validation frameworks
- Experiment/test tooling: Promptfoo, Ragas, DeepEval
- Schema validation: Zod, Valibot, Ajv, JSON Schema tooling, plus AI-specific output validation wrappers
- LLM-as-a-judge systems: pervasive across many frameworks and internal teams

The key point is that the market is not empty; it is simply fragmented by problem definition.

What most of these tools do well:
- measure model quality
- compare prompts or model versions
- trace production traffic
- evaluate quality over datasets
- implement policy checks

What they do not do well or do not do at all:
- create a small, TypeScript-native, runtime-first validation library for application developers
- treat deterministic evaluation as the default and LLM evaluation as optional
- emphasize high-signal “fail fast” logic over generalized experimentation
- work well in plain Node/TypeScript without cloud or framework coupling
- provide a clean, composable failure model suitable for agent/tool validation

This gap is not theoretical; it is practical and visible in day-to-day AI app engineering.

---

## 5. Identified Gaps

The largest gaps in the current ecosystem are:

1. TypeScript-native runtime validation
   - Most robust guardrail libraries are Python-first.
   - TypeScript teams are left with ad hoc validation logic, custom wrappers, or heavy platform dependencies.

2. Deterministic checks before LLM-as-a-judge
   - Many teams jump straight to LLM-as-a-judge decisions even when the answer can be checked cheaply and deterministically.

3. Tool-call and workflow validation for agents
   - Agent failures often happen in tool arguments, preconditions, and sequence logic, not only model output text.

4. Reusable assertion primitives for service code
   - There is a gap between “full observability platform” and “tiny library inserted into service code.”

5. Production-oriented evaluation without platform baggage
   - Teams want to validate and classify failures in application runtime, not just run offline evaluations in a dashboard.

6. Small but credible OSS package story
   - Many evaluation OSS projects become broad frameworks or hosted platforms. A minimal TypeScript library is easier to ship, easier to test, and easier to productize as a profile-worthy open-source project.

7. Clear separation between validation, evaluation, and observability
   - The industry often conflates these concepts. The project can provide a clean model that distinguishes them.

---

## 6. Candidate Project Directions

### Candidate A: Deterministic LLM output validator

Problem:
- Validate outputs against exact or business-driven constraints before accepting them.

Target users:
- backend engineers, AI app engineers, prompt engineers.

Alternatives:
- JSON Schema validators, Zod, custom checks, Guardrails.

Differentiation:
- opinionated “LLM output reliability” library tailored to AI apps.

Technical complexity:
- moderate

Implementation effort:
- low to moderate

OSS appeal:
- strong if framed as “AI-safe runtime checks”

Potential adoption:
- high among TypeScript teams

Extensibility:
- good, especially through check plugins

Interview value:
- strong, because it combines validation design, TypeScript, and AI reliability

Portfolio value:
- strong

v0.1 speed:
- very good

### Candidate B: Hybrid LLM + deterministic evaluator

Problem:
- Use cheap deterministic checks first, then optional semantic evaluation only when needed.

Target users:
- teams with both business rules and subjective quality concerns.

Alternatives:
- Ragas, LangSmith, custom pipelines.

Differentiation:
- runtime-first hybrid scoring, not dataset-first evaluation.

Technical complexity:
- moderate to high

Implementation effort:
- moderate

OSS appeal:
- good

Potential adoption:
- good if the hybrid decision model is clear and simple

Extensibility:
- excellent

Interview value:
- strong

Portfolio value:
- very strong

v0.1 speed:
- good if scope stays intentionally narrow

### Candidate C: Agent/tool-call validator

Problem:
- Ensure tool calls, arguments, and action plans are valid before execution.

Target users:
- agent developers and backend engineers building tool-using workflows.

Alternatives:
- custom agent wrappers, LangGraph validation, business logic around tools.

Differentiation:
- validation + repair layer for tool calling and tool argument safety.

Technical complexity:
- moderate to high

Implementation effort:
- moderate

OSS appeal:
- strong among agent developers

Potential adoption:
- good in AI agent circles

Extensibility:
- strong, especially for workflows and tool schemas

Interview value:
- very strong

Portfolio value:
- strong

v0.1 speed:
- moderate; good if limited to argument validation and tool contract enforcement

### Candidate D: LLM regression-testing framework

Problem:
- Keep model prompts and outputs stable across refactors.

Target users:
- teams doing prompt versioning and model/regression testing.

Alternatives:
- Promptfoo, LangSmith eval datasets, custom test runners.

Differentiation:
- smaller, code-native, TypeScript-based regression framework with deterministic checks.

Technical complexity:
- moderate

Implementation effort:
- moderate

OSS appeal:
- good

Potential adoption:
- solid for dev teams

Extensibility:
- good

Interview value:
- good

Portfolio value:
- strong

v0.1 speed:
- good

### Candidate E: Production failure-handling middleware

Problem:
- Retry, repair, or reject bad LLM/tool outputs in production flow control.

Target users:
- platform engineers, AI service maintainers, production systems teams.

Alternatives:
- application-level retry loops, agent loops, proprietary middleware.

Differentiation:
- explicit reliability policy engine for AI app retries and repair actions.

Technical complexity:
- moderate to high

Implementation effort:
- moderate

OSS appeal:
- good but maybe too operationally broad

Potential adoption:
- good among production AI apps

Extensibility:
- strong

Interview value:
- excellent

Portfolio value:
- strong

v0.1 speed:
- moderate; likely too broad for the first release if not sharply limited

### Candidate F: Structured-output reliability toolkit

Problem:
- Guarantee JSON or typed outputs can be consumed by downstream systems.

Target users:
- backend services, tool-calling integrations, orchestrators.

Alternatives:
- Zod, JSON Schema, Pydantic-like patterns in Python, Guardrails.

Differentiation:
- AI-specific reliability layer for schema + semantic + repair validation.

Technical complexity:
- moderate

Implementation effort:
- low to moderate

OSS appeal:
- strong because it is practical and immediately useful

Potential adoption:
- high

Extensibility:
- very good

Interview value:
- strong

Portfolio value:
- strong

v0.1 speed:
- excellent

---

## 7. Trade-off Analysis

The most appealing direction is not the broadest one; it is the one that solves a real, tangible pain point while staying simple to understand and easy to build credibly.

The broadest project direction (“general AI evaluation framework”) is attractive in theory but weaker in practice because it tends to collapse into a platform project with too many moving parts. The real product opportunity is a smaller but deeper library with strong TypeScript ergonomics and reliable deterministic primitives.

A “complete AI observability platform” is also a poor choice for the first project because it creates operational overhead, infrastructure questions, and a long path to a credible v0.1. The project should not become a dashboard or deployment-time system.

The best candidate is a hybrid of deterministic validation and optional semantic assessment, with a narrow focus on output and tool-call reliability. This gives the project:

- immediate practical value,
- strong TypeScript usability,
- clear differentiation from both observability platforms and broad evaluator frameworks,
- room to grow into datasets, tracing, and adapters later,
- an engineering story that is credible in a backend/AI role interview.

The main trade-off is that it intentionally does not cover full prompt benchmarking or hosted evaluation workflows in v0.1. That is a feature, not a bug: keeping the initial scope sharp makes the package credible and likely to be adopted.

---

## 8. Recommended Direction

The recommended project is a TypeScript-first runtime reliability toolkit for validating and classifying LLM outputs and agent actions with deterministic checks before optional model-based evaluation is used.

It should feel like a developer-facing library for “fail fast, explain clearly, and repair smartly” rather than a dashboard or hosted service.

This direction best balances:

- real developer pain,
- strong backend/AI engineering signal,
- manageable implementation effort,
- modularity for future expansion,
- genuine TypeScript credibility,
- usefulness for AI app developers without requiring platform adoption.

---

## 9. Positioning

This project provides a lightweight reliability layer for developers building LLM and agent applications without requiring them to adopt a broad evaluation platform, embed heavy framework runtime dependencies, or rely on expensive LLM-as-a-judge checks for every failure.

Primary user:
- TypeScript backend and AI engineers building Node services with model outputs, structured responses, or tool-calling agents.

Deliberately outside scope:
- hosted dashboard or SaaS platform
- a full-blown agent framework
- dataset management as a primary product
- broad prompt optimization workflows
- distributed infrastructure or self-hosted serious platform operations
- a massive generic model evaluation suite

Why install this instead of existing frameworks:
- it is small and composable,
- it prioritizes deterministic checks and runtime safety,
- it is framework-agnostic,
- it works in plain TypeScript services,
- it offers a clean API for validation + classification + optional repair strategy, not just tracing.

Unique value proposition:
- fail-fast validation and reliability checks for LLM outputs and agent actions at the application boundary, with strong typing and low operational cost.

Project type:
- primary: runtime library
- secondary: developer/testing framework
- optional: CLI for local validation and fixtures

---

## 10. Architecture Options

### Architecture A: Core TypeScript library

Package structure:
- single package or minimal package layout
- `core` domain logic and checks in one package

API design:
- `evaluate()`, `validate()`, `assert()`, `check()` with typed result objects

Dependency management:
- minimal runtime dependencies; no heavy framework requirements

Extensibility:
- good via custom check implementations and adapters

Testing:
- straightforward unit and fixture-based tests

Runtime overhead:
- very low

Developer experience:
- extremely simple for app developers

Versioning:
- easy to manage

Future compatibility:
- good for small project evolution

OSS contribution friendliness:
- excellent for a small package

Assessment:
- excellent for early v0.1, but may feel limiting if we later want package split by integration.

### Architecture B: Core library + adapter packages

Package structure:
- `@project/core`
- `@project/openai`
- `@project/langchain`
- `@project/langfuse`

API design:
- core is pure and independent; adapters wrap provider-specific conventions

Dependency management:
- modular; optional dependency installation

Extensibility:
- excellent

Testing:
- modular but more complex

Runtime overhead:
- low

Developer experience:
- good when integrations are optional and clearly separated

Versioning:
- more complex but manageable with workspace tooling

Future compatibility:
- excellent

OSS contribution friendliness:
- strong

Assessment:
- best long-term architecture, but not necessary for v0.1 unless there is a clear need.

### Architecture C: Core library + CLI

Package structure:
- core library + `cli` package

API design:
- core library for code usage; CLI for local evaluation runs and dataset fixtures

Dependency management:
- moderate

Extensibility:
- good

Testing:
- CLI tests add some complexity but are useful

Runtime overhead:
- low

Developer experience:
- strong for local testing and CI integration

Versioning:
- manageable

Future compatibility:
- good

OSS contribution friendliness:
- good

Assessment:
- useful for v0.2/v0.3, not mandatory for v0.1.

### Architecture D: Core library + integrations/plugins

Package structure:
- core library + plugin registry + provider-specific integration packages

API design:
- more complex plugin system

Dependency management:
- more involved

Extensibility:
- very high

Testing:
- higher complexity

Runtime overhead:
- low to moderate

Developer experience:
- can become fragmented if not controlled

Versioning:
- challenging without discipline

Future compatibility:
- strong but more long-term investment

OSS contribution friendliness:
- good if documented well

Assessment:
- good long-term direction, but likely too much for the first release.

### Architecture E: Library + hosted/dashboard layer

Package structure:
- core library + hosted service + UI/dashboard

API design:
- complex, platform-like

Dependency management:
- broad and operationally heavy

Extensibility:
- high

Testing:
- operational complexity goes up substantially

Runtime overhead:
- moderate to high

Developer experience:
- can be powerful but requires more setup and maintenance

Versioning:
- difficult

Future compatibility:
- possible but more risky

OSS contribution friendliness:
- fair, but mostly for teams with platform capacity

Assessment:
- explicitly rejected for v0.1 and likely for the project as a whole.

### Recommendation

Recommend Architecture B as the long-term end state, but begin with Architecture A for v0.1: a single, well-typed TypeScript package with a clean internal plugin/check interface. Add adapters later only when they are clearly justified.

---

## 11. Recommended Architecture

The recommended architecture is:

- a core TypeScript package that defines a generic validation/evaluation model,
- deterministic checks implemented natively in the package,
- custom checks and evaluators through a simple interface,
- optional adapter layer for OpenAI/LangChain/Langfuse at the edges,
- no required cloud or hosted infrastructure,
- no mandatory framework coupling,
- a small CLI for running validation fixtures in local or CI contexts.

This is the right balance between a clean OSS package and future extensibility.

---

## 12. Core Domain Model

The project does not need a huge domain model. The smallest coherent domain model is:

- `Check`: a reusable validation rule or evaluator
- `Context`: evaluation metadata, model config, trace identifiers, input/output pair, tool data
- `EvaluationResult`: the outcome of a run
- `Failure`: one or more machine-readable structured issues
- `Severity`: `info`, `warning`, `error`, `critical`
- `Evaluator`: a callable abstraction for either deterministic or LLM-backed reasoning
- `RepairStrategy`: optional fallback or fix action when a failure is recoverable
- `Dataset` / `Fixture`: optional test cases for regression suites

This is enough for the project without over-engineering.

A compact conceptual model:

- `check` or `validator` runs against input/output and returns a `CheckResult`
- `EvaluationResult` contains `passed`, `failures`, and optional `warnings`
- `Failure` includes `code`, `message`, `severity`, `path`, `metadata`, and optional `suggestedRepair`

The API should keep the number of moving parts small and strongly typed.

---

## 13. API Design Exploration

### Option 1: Evaluate-style API

```ts
const result = await evaluate({
  input,
  output,
  checks: [
    schemaCheck(schema),
    requiredFields(["name", "email"]),
    noExtraFields(),
  ],
});
```

Pros:
- natural and explicit
- easy for developers to read
- clear “evaluate this output” semantics

Cons:
- may be too broad if we also want to support runtime enforcement or tool validation

### Option 2: Validate/assert API

```ts
const result = validateOutput({
  output,
  rules: [
    schemaRule(schema),
    fieldRule("name", nonEmpty()),
  ],
});
```

Pros:
- more obvious as runtime enforcement
- good for fail-fast semantics

Cons:
- slightly less future-proof if we also want evaluation workflows

### Option 3: Check pipeline API

```ts
const result = await runChecks({
  context,
  checks: [
    requireStructuredJson(),
    validateRequiredFields(),
    checkToolCallArguments(),
  ],
});
```

Pros:
- flexible and composable
- good for custom evaluator composition

Cons:
- may feel generic and less ergonomic without strong TS typing

### Recommendation

Use a small set of names, but keep the core semantics consistent:

- `validate` for deterministic runtime enforcement and narrow output checks
- `evaluate` for broader result processing including optional LLM-based scoring
- `assert` as convenience in developer code, if desired

This keeps the API readable while maintaining a clear separation between “deterministic validation” and “semantic evaluation.”

---

## 14. Deterministic vs LLM Evaluation Strategy

This is the central design decision.

### Deterministic validation is preferred when:

- output structure can be checked with JSON Schema or TypeScript rules
- required fields are known
- enums or allowed values are known
- claims can be cross-checked against trusted data or context
- tool call schemas can be validated against function metadata
- safety rules can be expressed as code

Examples:
- missing field
- invalid enum
- wrong JSON schema
- tool argument mismatch
- unsupported values
- negative contradictions derived from source context

### LLM-as-a-judge is appropriate when:

- semantic quality is subjective and cannot be reduced to rules
- the task is ambiguous and depends on conversational coherence
- there is no single deterministic oracle
- we need to identify unsupported claims or poor reasoning quality in a broad conceptual sense

But even here, it should be optional and clearly labeled as a “semantic score,” not a definitive truth check.

The guiding principle:

When a failure can be detected deterministically, do not unnecessarily use another LLM call.

This is a key product principle because it yields:

- lower cost,
- lower latency,
- better explainability,
- simpler testing,
- stronger trust in the library’s behavior.

### v0.1 strategy

Default support for:
- deterministic validation rules
- custom code-based checks
- structured output validation
- basic tool-call contract validation

Optional support for:
- LLM-as-a-judge scoring behind a provider adapter
- semantic safety or content quality checks

Explicitly not in v0.1:
- generic model comparison benchmark engine
- fully autonomous evaluation loops
- broad agent trajectory judging

---

## 15. Integration Strategy

The project should not require all providers or frameworks to be mandatory. The integration model should be modular and optional.

Recommended v0.1 integrations:
- none required for the core library
- optional integration with OpenAI SDK for model-based semantic checks only
- optional integration for LangChain/LangGraph tool-call validation if there is demand
- optional integration with OpenTelemetry for trace metadata export if needed
- optional integration with Langfuse for evaluation result export, not as a runtime dependency

Avoid building a giant integration matrix in v0.1.

Recommended package structure if integrations are added:

- `@project/core`
- `@project/openai`
- `@project/langchain`
- `@project/langfuse`
- `@project/cli`

This is justified only if there is real upstream demand. Otherwise, keep the integrations in example directories or small optional companions.

---

## 16. MVP Scope

### MUST HAVE

- TypeScript package with clear API
- strong typing and minimal runtime dependencies
- deterministic validation primitives
- structured output validation support
- failure result model with severity, code, metadata, and path
- custom check interface for user-defined validations
- tests covering success and failure paths
- example usage for JSON schema and output validation
- README and documentation
- package publishing metadata and CI

### SHOULD HAVE

- optional LLM-based semantic evaluation adapter
- tool-call argument validation helpers
- CLI to run validation fixtures locally
- examples for agent flows and retry/repair behavior
- golden/regression test support

### NICE TO HAVE

- traces/export integration with OpenTelemetry or Langfuse
- dataset fixture runner
- repair strategies for common patterns
- plugin registry for third-party checks

### NOT NOW

- hosted dashboard
- full dataset management platform
- remote service or cloud evaluation engine
- full agent execution framework
- broad multi-model benchmarking suite
- production SaaS features or auth flows
- Kubernetes or distributed orchestration

This MVP should be small, credible, and releaseable in roughly 1–3 weeks part-time.

---

## 17. Repository Structure

Recommended structure:

```text
.
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── checks/
│   │   │   ├── evaluators/
│   │   │   ├── failures/
│   │   │   ├── result/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/
│   │   └── src/
│   ├── openai/
│   │   └── src/
│   ├── langchain/
│   │   └── src/
│   └── langfuse/
│       └── src/
├── examples/
├── docs/
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── .github/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── .eslintrc.json
└── .github/workflows/
```

Why this structure:

- simple monorepo, not a heavy platform
- package boundaries are clear
- contributor-friendly
- easy to independently publish core and optional packages
- avoids the complexity of Turborepo or Nx unless the repo becomes much larger

Recommendation:
- use `pnpm` workspaces for simplicity and speed
- avoid Turborepo/Nx for v0.1 unless tooling needs justify it

---

## 18. Testing Strategy

The project should be testable without external API keys.

### Unit tests

- validation rule behavior
- failure serialization
- result aggregation
- repair strategy logic
- custom check composition

### Integration tests

- check execution against realistic example outputs
- tool-call validation scenarios
- structured JSON validation pipelines

### Fixture-based tests

- golden outputs for known valid/invalid examples
- regression cases for common prompt or output failure patterns

### Property-based tests

Use only where useful, such as schema validation permutations or arbitrary structured outputs.

### Mock provider tests

- for LLM-based semantic checks, use mock adapters or stubbed provider responses
- test provider contract behavior without requiring network calls

### Real-provider tests

- keep them opt-in and labeled as integration tests
- must be skipped unless API credentials are provided

This keeps the core CI cheap and deterministic.

---

## 19. OSS Strategy

The project should be designed so that outside contributors can realistically participate without a huge organizational overhead.

Recommended files:
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `SECURITY.md`
- issue templates for bug reports and feature requests
- PR template with checklists
- GitHub Actions for lint/test/build
- semantic versioning
- `CHANGELOG.md`
- release workflow
- architecture docs and examples directory

Good first issues should include:
- new deterministic check implementations
- documentation examples
- schema validation edge cases
- custom evaluator examples
- adapter improvements

The repository should stay small and focused to remain contributor-friendly.

---

## 20. Roadmap

### v0.1

Functionality:
- core validation library
- deterministic checks
- structured output validation
- failure/result model
- examples and docs
- CI and release prep

Reason:
- demonstrates real utility and a sharp, credible initial version

Explicitly wait:
- broad integrations
- hosted UI
- complex agent evaluation loops

Contributor opportunities:
- new checks, docs, validation examples

### v0.2

Functionality:
- tool-call validation helpers
- custom evaluator interface
- CLI for fixture runs
- integration examples for OpenAI/LangChain

Reason:
- makes the package useful for common LLM app and agent patterns

Explicitly wait:
- dataset management, dashboards, heavy observability features

Contributor opportunities:
- new adapters, CLI commands, test fixtures

### v0.3

Functionality:
- repair strategy abstractions
- retry policy patterns
- optional semantic evaluation adapters
- richer trace metadata support

Reason:
- introduces production-oriented reliability workflows without becoming a platform

Explicitly wait:
- hosted SaaS or observability dashboard

Contributor opportunities:
- reliability policy patterns, docs, examples

### v1.0

Functionality:
- stable public API
- proven integration patterns
- core set of deterministic checks and adapter contracts
- robust docs and contributor process

Reason:
- mature enough for production usage by TypeScript-based AI teams

Explicitly wait:
- broad multi-provider ecosystem and hosted dashboard layer

Contributor opportunities:
- advanced evaluators, production integrations, documentation

---

## 21. Risks

- The project could accidentally become a general-purpose “AI evaluation framework” instead of a tough runtime validation library.
- Without enough discipline, the API may become too abstract and lose developer ergonomics.
- Over-indexing on LLM-as-a-judge would create cost, latency, and reliability issues.
- Tool-call validation may be attractive but could expand into a generic agent framework too quickly.
- If integrations are added too early, the package structure becomes too complex for a small v0.1.

Mitigation:
- keep the first release focused on deterministic validation and output safety
- preserve a simple core API
- make semantic evaluation optional and explicit
- avoid a hosted/platform story in the first release

---

## 22. Open Questions

- Should the library be strictly deterministic-first, or should it include a small semantic scorer as an optional feature from the beginning?
- Do we target only TypeScript/Node, or should we also define a clear cross-language contract for future use?
- Do we need a CLI as part of v0.1, or can it wait until v0.2?
- Should tool-call validation be a first-class check type or a domain-specific extension?
- How much metadata should be carried in `Failure` objects to remain useful without turning them into a giant schema?
- Is there a compelling reason to create first-party adapters for OpenAI/LangChain, or should examples alone suffice?
- Should the project include repair strategies or should “failure + suggestion” be enough for the first release?

---

## 23. Architecture Decision Record

### Problem

Developers building LLM and agent applications need a small, reliable way to detect and classify predictable failures before they are accepted into a workflow.

### Context

The market includes evaluation platforms, observability systems, and guardrail libraries, but few are TypeScript-native, runtime-first, and deterministic by default. Broad frameworks are heavy, expensive, and operationally more complex than many teams need.

### Alternatives considered

- General-purpose evaluation framework
- Full observability platform
- Python guardrail clone
- Broad agent evaluation suite
- Narrow deterministic validation library
- Hybrid deterministic + LLM evaluator library

### Decision

Build a TypeScript-first hybrid validation/evaluation library focused on deterministic checks first and optional LLM-based semantic evaluation second.

### Reasons

- strongest fit for TypeScript backend/AI engineering skills
- practical runtime value
- smaller OSS package size for credible v0.1
- easier to test and maintain
- broad enough to be useful, narrow enough to be realistic

### Trade-offs

- We intentionally do not build a full platform or hosted solution.
- We do not solve every prompt optimization and benchmarking problem in v0.1.
- We leave some observability/dashboard integration for later.

### Consequences

- The library is easy to adopt by TypeScript service developers.
- It has a clear narrative in OSS and interviews.
- It is extensible without becoming a general AI framework.
- It does not aim to replace Langfuse, LangSmith, or full evaluation platforms.

### Future alternatives

- Add adapters for OpenAI, LangChain, and LangGraph
- Add CLI and dataset runner
- Add richer trace/export integration with Langfuse or OTel
- Add optional hosted dashboard only after the core library proves adoption

---

## 24. Implementation Plan

This implementation plan is intentionally incremental and designed to keep each step independently reviewable.

### Step 1: Initialize repository and tooling

Goal:
- set up a minimal TypeScript monorepo structure and quality tooling

Files/modules:
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `vitest.config.ts`
- lint and formatting config

Expected behavior:
- a clean package setup with minimal dependencies

Tests:
- config validation, package build checks

Dependencies:
- `typescript`, `vitest`, `tsup` or equivalent build tooling, `eslint` if used

### Step 2: Define the core domain model

Goal:
- establish the core result/failure/check types

Files/modules:
- `packages/core/src/types.ts`
- `packages/core/src/result.ts`
- `packages/core/src/failures.ts`

Expected behavior:
- `Check`, `Failure`, `EvaluationResult`, and metadata model work end-to-end

Tests:
- result aggregation and failure serialization

Dependencies:
- no external AI provider dependencies

### Step 3: Implement deterministic checks

Goal:
- provide the first useful validation primitives

Files/modules:
- `packages/core/src/checks/schema.ts`
- `packages/core/src/checks/requiredFields.ts`
- `packages/core/src/checks/valueConstraints.ts`
- `packages/core/src/checks/toolCall.ts`

Expected behavior:
- JSON schema validation, required fields, enum rules, and basic tool contract checks function correctly

Tests:
- valid and invalid examples for each built-in check

Dependencies:
- `zod` or a small internal schema validator if needed; keep minimal and deliberate

### Step 4: Implement evaluator abstraction and registry

Goal:
- allow custom if/then validation logic and composability

Files/modules:
- `packages/core/src/evaluators.ts`
- `packages/core/src/registry.ts`

Expected behavior:
- checks can be combined and executed in sequence

Tests:
- custom evaluator registration and result aggregation

Dependencies:
- none beyond the core package

### Step 5: Add fixture-based regression tests

Goal:
- keep reliability patterns reproducible

Files/modules:
- `packages/core/test/fixtures/*.json`
- test runner files

Expected behavior:
- common known-valid and known-invalid AI outputs are automatically tested

Tests:
- fixture-based tests for known failure modes

Dependencies:
- none beyond test tooling

### Step 6: Add optional semantic evaluator adapter

Goal:
- support LLM-based evaluation when deterministic logic is insufficient

Files/modules:
- `packages/core/src/semantic.ts`
- `packages/openai/src/semantic.ts`

Expected behavior:
- an optional provider-backed semantic judge is available but not required

Tests:
- mocked semantic judge behavior

Dependencies:
- optional provider SDKs only

### Step 7: Add CLI for local validation runs

Goal:
- allow local use in CI or manual validation runs

Files/modules:
- `packages/cli/src/index.ts`

Expected behavior:
- validate a fixture file or inline JSON and print failures clearly

Tests:
- CLI tests using fixture files

Dependencies:
- minimal CLI libraries only

### Step 8: Add documentation and examples

Goal:
- make the value obvious in under one minute

Files/modules:
- `README.md`
- `docs/` examples
- `examples/`

Expected behavior:
- audiences understand what the library does and why it matters

Tests:
- docs examples verified in build or smoke test if practical

Dependencies:
- none beyond doc tooling

### Step 9: Add CI and release automation

Goal:
- enable contributor confidence and release quality

Files/modules:
- `.github/workflows/*`
- release config

Expected behavior:
- lint, build, and tests run automatically

Tests:
- CI validation runs

Dependencies:
- GitHub Actions only

### Step 10: Prepare v0.1 release

Goal:
- ship a scoped, credible first version

Files/modules:
- release notes
- changelog
- package metadata

Expected behavior:
- package is publishable, documented, and stable enough for early adopters

Tests:
- release checks, package build, smoke install test

Dependencies:
- package registry and semver process

---

## FINAL_RECOMMENDATION

- Project name recommendation: `llm-reliability-checks` or `ai-guardrails-ts` (choose the name after validating the market positioning)
- One-sentence purpose: A TypeScript-first runtime validation library for detecting deterministic failures in LLM outputs and agent tool calls before they propagate.
- Target users: TypeScript backend engineers, AI application developers, and agent builders who need real reliability checks without adopting a large platform.
- v0.1 scope: deterministic validation primitives, structured-output checks, failure/result model, custom checks, examples, tests, docs, optional semantic evaluator adapter.
- Architecture: core TypeScript library first, optional adapters later, minimal monorepo with workspaces, no hosted platform in v0.1.
- Core technologies: TypeScript, Node.js, Zod or lightweight validation primitives, Vitest, pnpm workspaces.
- Initial integrations: optional OpenAI semantic adapter, optional LangChain/LangGraph tool-validation examples, optional OpenTelemetry/ Langfuse export hooks.
- What makes it different: it is deterministic-first, TypeScript-native, runtime-oriented, and designed for fail-fast reliability rather than broad AI-platform abstraction.
- What we explicitly decided NOT to build: a full evaluation dashboard, a hosted SaaS platform, a general-purpose agent framework, a huge benchmark suite, or a broad “do everything for AI” framework.

This is the decision that best matches the research: narrow enough to ship, broad enough to matter, and strong enough to stand out as a credible engineering project.
