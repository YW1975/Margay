# Model Evaluation Report v3.0

**Date**: 2026-02-14T19:26:35.820Z
**Prompt Set Version**: 3.0
**Models Tested**: 14
**Prompts**: 28 (T1-T18 plan-aligned + M1-M10 Margay scenarios)

## Summary

| Provider | Model | Pass | Fail | Error | Timeout | Avg Latency |
|----------|-------|------|------|-------|---------|-------------|
| OpenAI-Chat | `gpt-5.2` | 25 | 3 | 0 | 0 | 7553ms |
| OpenAI-Mini | `gpt-4.1-mini` | 26 | 2 | 0 | 0 | 5296ms |
| Gemini-Pro (fb) | `gemini-2.5-pro` | 21 | 7 | 0 | 0 | 13801ms |
| Gemini-Flash (fb) | `gemini-2.5-flash` | 18 | 10 | 0 | 0 | 6622ms |
| Claude-Opus | `claude-opus-4-6` | 25 | 3 | 0 | 0 | 11624ms |
| Claude-Sonnet | `claude-sonnet-4-5-20250929` | 25 | 3 | 0 | 0 | 9563ms |
| DeepSeek-Chat | `deepseek-chat` | 26 | 2 | 0 | 0 | 9011ms |
| DeepSeek-Coder | `deepseek-coder` | 26 | 2 | 0 | 0 | 8095ms |
| MiniMax | `MiniMax-M1` | 23 | 5 | 0 | 0 | 19074ms |
| Qwen-Chat | `qwen/qwen3-max-thinking` | 26 | 2 | 0 | 0 | 14862ms |
| Qwen-Coder | `qwen/qwen3-coder` | 26 | 2 | 0 | 0 | 7935ms |
| Zhipu-GLM | `z-ai/glm-5` | 9 | 19 | 0 | 0 | 18969ms |
| Kimi | `moonshotai/kimi-k2.5` | 13 | 14 | 0 | 1 | 19080ms |
| Baidu-ERNIE | `baidu/ernie-4.5-300b-a47b` | 24 | 2 | 2 | 0 | 11261ms |

## Basic & Instruction (T1-T2)

### T1-text-gen (basic)

> 用一句话解释量子纠缠，要求小学生能理解。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 2571ms | 2/2 | 量子纠缠就像一对“神奇的双胞胎球”，不管分得多远，你一看其中一个是什么样，另一个立刻就知道并变成对应的样子。 |
| OpenAI-Mini | PASS | 901ms | 2/2 | 量子纠缠就像两个好朋友的魔法绳子，无论他们分开多远，一个变了，另一个也会马上变。 |
| Gemini-Pro (fb) | PASS | 15982ms | 2/2 | 量子纠缠就像一对有魔法的手套，你把一只留在家里，另一只带到月球，只要你看到家里的这只是左手手套，你就立刻知道月球上那只一定是右手手套。 |
| Gemini-Flash (fb) | PASS | 2150ms | 2/2 | 量子纠缠就像一对特殊的双胞胎，不管它们离得多远，你对其中一个做任何事情，另一个都会立刻知道并做出一样的反应，就像它们之间有看不见的魔法连接一样。 |
| Claude-Opus | PASS | 3013ms | 2/2 | 量子纠缠就像一对有魔法的双胞胎，不管相隔多远，一个打喷嚏，另一个会同时也打喷嚏。 |
| Claude-Sonnet | FAIL | 2830ms | 0/2 | 两个神奇的粒子像心有灵犀的双胞胎，无论离多远，一个转圈，另一个立刻就知道并跟着转。 |
| DeepSeek-Chat | PASS | 1979ms | 2/2 | 量子纠缠就像一对魔法骰子：无论把它们分开多远，只要其中一个掷出“6”，另一个也会瞬间变成“6”——它们永远保持同步！ |
| DeepSeek-Coder | PASS | 1591ms | 2/2 | 量子纠缠就像一对魔法骰子，无论相隔多远，只要其中一个掷出“6”，另一个也会瞬间变成“6”。 |
| MiniMax | FAIL | 5497ms | 0/2 | 就像一对“双胞胎”玩具球，你把它们分别送到很远很远的地方（比如一个放在北京，一个放在广州），如果你把北京的球变成红色，广州的球会立刻变成蓝色——它们之间有一种“ |
| Qwen-Chat | PASS | 3046ms | 2/2 | 量子纠缠就像一对有“心灵感应”的小粒子，不管它们离得多远，一个变了，另一个马上也会跟着变！ |
| Qwen-Coder | PASS | 1772ms | 2/2 | 量子纠缠就像两个双胞胎兄弟，无论相隔多远，当其中一个开心时，另一个也会立刻开心，仿佛他们之间有神奇的心灵感应。 |
| Zhipu-GLM | FAIL | 20770ms | 0/2 |  |
| Kimi | PASS | 20582ms | 2/2 |  量子纠缠就像是一对不管相隔多远都能心灵感应的魔法双胞胎，只要一个人笑了，另一个人也会立刻笑起来。 |
| Baidu-ERNIE | FAIL | 2730ms | 0/2 | 两个魔法粒子就像被一根隐形绳子绑在一起的特别朋友，不管离得多远，当一个开心转圈时，另一个会立刻跟着同步转圈，就像有心灵感应一样！ |

### T2-instruction (instruction-following)

> 列出 5 个水果，每个用一个 emoji 开头，按字母顺序排列，用英文回答。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1763ms | 2/2 | - 🍎 Apple   - 🍌 Banana   - 🍇 Grape   - 🥭 Mango   - 🍊 Orange |
| OpenAI-Mini | PASS | 723ms | 2/2 | 🍌 Banana   🍒 Cherry   🍇 Grape   🍎 Apple   🍉 Watermelon |
| Gemini-Pro (fb) | PASS | 3271ms | 2/2 | 🍎 Apple 🍌 Banana 🍒 Cherry 🍇 Grapes 🍊 Orange |
| Gemini-Flash (fb) | PASS | 2126ms | 2/2 | 🍎 Apple 🍌 Banana 🍒 Cherry 🍇 Grape 🥭 Mango |
| Claude-Opus | PASS | 2778ms | 1/2 | Here are 5 fruits in alphabetical order, each starting with an emoji:  🍎 Apple  |
| Claude-Sonnet | PASS | 1707ms | 2/2 | 🍎 Apple 🍌 Banana 🍒 Cherry 🍇 Grape 🍊 Orange |
| DeepSeek-Chat | PASS | 1499ms | 2/2 | 🍎 Apple   🍌 Banana   🍇 Grape   🥭 Mango   🍓 Strawberry |
| DeepSeek-Coder | PASS | 1383ms | 2/2 | 🍎 Apple   🍌 Banana   🍇 Grape   🥝 Kiwi   🍊 Orange |
| MiniMax | FAIL | 5092ms | 0/2 |  |
| Qwen-Chat | PASS | 1563ms | 2/2 | 🍎 Apple   🍌 Banana   🍒 Cherry   🍇 Grape   🍊 Orange |
| Qwen-Coder | PASS | 2030ms | 2/2 | Here are 5 fruits listed in alphabetical order, each starting with an emoji:  🍎 |
| Zhipu-GLM | PASS | 6014ms | 2/2 | 1. 🍎 Apple 2. 🍌 Banana 3. 🍒 Cherry 4. 🍇 Grape 5. 🍊 Orange |
| Kimi | PASS | 3115ms | 2/2 |  🍎 Apple   🍌 Banana   🍒 Cherry   🍇 Grape   🍊 Orange |
| Baidu-ERNIE | PASS | 2637ms | 2/2 | 1. 🍎 Apple   2. 🍌 Banana   3. 🍇 Grapes   4. 🍊 Orange   5. 🍓 Strawberry |

## Code (T3, T11)

### T3-coding (code)

> Write a Python function `merge_sorted(a, b)` that merges two sorted lists into one sorted list. Include type hints. Do n...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 3328ms | 2/2 | ```python from typing import List, Sequence, TypeVar  T = TypeVar("T")  def merg |
| OpenAI-Mini | PASS | 2463ms | 2/2 | ```python from typing import List  def merge_sorted(a: List[int], b: List[int])  |
| Gemini-Pro (fb) | FAIL | 11184ms | 0/2 |  |
| Gemini-Flash (fb) | FAIL | 3602ms | 0/2 |  |
| Claude-Opus | PASS | 10194ms | 2/2 | ```python def merge_sorted(a: list[int], b: list[int]) -> list[int]:     """Merg |
| Claude-Sonnet | PASS | 7668ms | 2/2 | ```python def merge_sorted(a: list[int], b: list[int]) -> list[int]:     """     |
| DeepSeek-Chat | PASS | 14134ms | 2/2 | Here's a Python function that merges two sorted lists without using built-in sor |
| DeepSeek-Coder | PASS | 11702ms | 2/2 | Here's a Python function that merges two sorted lists without using built-in sor |
| MiniMax | PASS | 33965ms | 2/2 | # Solution: Merge Two Sorted Lists  Here's a clean implementation using the **tw |
| Qwen-Chat | PASS | 10427ms | 2/2 | ```python from typing import List  def merge_sorted(a: List[int], b: List[int])  |
| Qwen-Coder | PASS | 10934ms | 2/2 | ```python from typing import List  def merge_sorted(a: List[int], b: List[int])  |
| Zhipu-GLM | FAIL | 16775ms | 0/2 |  |
| Kimi | FAIL | 10528ms | 0/2 |  |
| Baidu-ERNIE | PASS | 14702ms | 2/2 | Here's a Python function `merge_sorted(a, b)` that merges two sorted lists into  |

### T11-app-dev (app-development)

> 用 TypeScript 实现一个命令行 TODO 工具，要求：
1. 支持 add/list/done/delete 四个子命令
2. 数据存储在 ~/.todo.json
3. list 输出带序号和完成状态 (✓/✗)
4. done...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 23032ms | 5/5 | ```ts #!/usr/bin/env node /**  * 一个无依赖（仅 Node.js 内置模块）的命令行 TODO 工具  *  * 用法：  *  |
| OpenAI-Mini | PASS | 13371ms | 5/5 | ```typescript #!/usr/bin/env ts-node  import * as fs from 'fs' import * as os fr |
| Gemini-Pro (fb) | FAIL | 48701ms | 0/5 | Got it. Here is the complete, single-file TypeScript code for the command-line T |
| Gemini-Flash (fb) | PASS | 25854ms | 5/5 | ```typescript import * as fs from 'fs'; import * as path from 'path'; import * a |
| Claude-Opus | PASS | 27273ms | 5/5 |   ```typescript #!/usr/bin/env node  import * as fs from "fs"; import * as path  |
| Claude-Sonnet | PASS | 24242ms | 5/5 | ```typescript #!/usr/bin/env node  import * as fs from 'fs'; import * as path fr |
| DeepSeek-Chat | PASS | 34368ms | 5/5 | 以下是一个完整的 TypeScript 命令行 TODO 工具实现：  ```typescript #!/usr/bin/env node  import {  |
| DeepSeek-Coder | PASS | 34811ms | 5/5 | 以下是用 TypeScript 实现的完整命令行 TODO 工具：  ```typescript #!/usr/bin/env node  import { r |
| MiniMax | PASS | 62770ms | 3/5 | # TypeScript 命令行 TODO 工具  我将创建一个完整可运行的 TODO 工具，包含编译后的 JavaScript 代码和 TypeScript  |
| Qwen-Chat | PASS | 37589ms | 5/5 | ```typescript #!/usr/bin/env node  import * as fs from 'fs'; import * as path fr |
| Qwen-Coder | PASS | 9262ms | 5/5 | ```typescript #!/usr/bin/env node  import * as fs from 'fs'; import * as path fr |
| Zhipu-GLM | FAIL | 46796ms | 0/5 |  |
| Kimi | PASS | 10028ms | 2/5 | 以下是完整的 TypeScript 实现，保存为 `todo.ts`：  ```typescript import * as fs from 'fs'; imp |
| Baidu-ERNIE | PASS | 41992ms | 5/5 | # TypeScript 命令行 TODO 工具实现  下面是一个完整的、可运行的 TypeScript 实现，满足所有要求：  ```typescript # |

## Reasoning (T4, T18)

### T4-reasoning (reasoning)

> 一个房间里有 3 盏灯和 3 个开关在门外。你只能进房间一次。如何确定每个开关对应哪盏灯？请详细解释你的推理过程。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 8514ms | 2/2 | 做法利用了“灯泡会发热”这一物理信息，把三种状态区分开来：**亮着 / 关着但很热 / 关着且冷**。步骤如下（只需进房间一次）：  1. **在门外先操作开关 |
| OpenAI-Mini | PASS | 8494ms | 2/2 | 这是一个经典的逻辑问题：有3个开关和3盏灯，开关和灯的对应关系未知，如何只进房间一次就能确定每个开关对应哪盏灯？  ---  ### 问题条件总结： - 房间内 |
| Gemini-Pro (fb) | PASS | 15783ms | 2/2 | 这是一个经典的逻辑谜题。解决方法是利用灯泡除了发光之外还会发热的特性。  ### 行动步骤：  1.  **打开第一个开关**，让它保持开启状态几分钟。 2.  |
| Gemini-Flash (fb) | PASS | 3157ms | 2/2 | 这是一个经典的逻辑谜题。以下是推理过程：  1.  **开关操作：**     *   首先，打开第一个开关（假设为开关 A）。     *   保持开关 A  |
| Claude-Opus | PASS | 12709ms | 2/2 | # 三盏灯与三个开关的经典谜题  ## 解题方案  ### 操作步骤：  **第一步：在门外操作开关**  1. **打开开关 1**，让它保持开启 **几分钟 |
| Claude-Sonnet | PASS | 11565ms | 2/2 | # 三盏灯与三个开关问题的解法  ## 解题思路  关键在于利用**灯泡的热量**这个容易被忽略的物理特征，而不仅仅是灯的亮灭状态。  ## 具体步骤  ### |
| DeepSeek-Chat | PASS | 9741ms | 2/2 | 好的，我们先明确一下题目条件：    - 房间里有 3 盏灯（假设是白炽灯，会发热，关掉后还会热一段时间）。   - 房间外有 3 个开关，分别控制这 3 盏灯 |
| DeepSeek-Coder | PASS | 10153ms | 2/2 | 这是一个经典的逻辑谜题，关键在于利用灯泡除了“亮”与“灭”之外的第三种状态——**发热**。    ---  **已知条件**   - 房间外有 3 个开关（开 |
| MiniMax | PASS | 19070ms | 2/2 | # 经典逻辑谜题：开关与灯的对应关系  ## 问题分析  这是一个考验逻辑思维的经典谜题。让我一步步分析：  ### 已知条件 - 3盏灯（门内） - 3个开关 |
| Qwen-Chat | PASS | 16581ms | 2/2 | 这是一个经典的逻辑谜题。问题的关键在于：**你只能进房间一次**，但需要确定**三个开关分别控制哪一盏灯**。表面上看，似乎信息不足，因为你无法在开关操作和观察 |
| Qwen-Coder | PASS | 3183ms | 2/2 | 这是一个经典的经典逻辑题。让我来详细解释解决方案：  ## 解决方案  **步骤1：标记开关** - 将三个开关分别标记为A、B、C  **步骤2：操作开关** |
| Zhipu-GLM | FAIL | 14564ms | 0/2 |  |
| Kimi | PASS | 13032ms | 1/2 |  这是一个经典的逻辑谜题，解决方案的关键在于**利用灯的温度作为第三种区分状态**。  ## 解决方案  **操作步骤：**  1. **第一步**：打开第一个 |
| Baidu-ERNIE | PASS | 19427ms | 2/2 | ### 初始理解问题  首先，我们需要清楚地理解题目所给的信息和要求：  1. **场景描述**：    - 有一个房间，里面有3盏灯。    - 房间外面有3 |

### T18-math (reasoning)

> What is the sum of the first 100 positive integers? Show your work using the Gauss formula.

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 2285ms | 1/1 | To sum the first 100 positive integers, use the Gauss (arithmetic series) formul |
| OpenAI-Mini | FAIL | 3165ms | 0/1 | To find the sum of the first 100 positive integers, we can use the **Gauss formu |
| Gemini-Pro (fb) | PASS | 4538ms | 1/1 | The sum of the first 100 positive integers can be calculated using the Gauss for |
| Gemini-Flash (fb) | PASS | 2992ms | 1/1 | The Gauss formula for the sum of the first `n` positive integers is `n * (n + 1) |
| Claude-Opus | FAIL | 5152ms | 0/1 | # Sum of the First 100 Positive Integers  ## The Gauss Formula  The sum of the f |
| Claude-Sonnet | FAIL | 6245ms | 0/1 | # Sum of the First 100 Positive Integers  ## The Gauss Formula  The formula for  |
| DeepSeek-Chat | PASS | 4643ms | 1/1 | Alright, let's go step-by-step.  ---  **Step 1: Understanding the problem**   We |
| DeepSeek-Coder | PASS | 4357ms | 1/1 | We want to find the sum of the first \( 100 \) positive integers:    \[ 1 + 2 +  |
| MiniMax | PASS | 26881ms | 1/1 | To find the sum of the first 100 positive integers we can use the classic “Gauss |
| Qwen-Chat | PASS | 13754ms | 1/1 | To find the sum of the first 100 positive integers, we can use **Gauss's formula |
| Qwen-Coder | FAIL | 11231ms | 0/1 | I'll find the sum of the first 100 positive integers using the Gauss formula.  T |
| Zhipu-GLM | FAIL | 14186ms | 0/1 |  |
| Kimi | FAIL | 10554ms | 0/1 | The sum of the first 100 positive integers is **5,050**.  ## Using the Gauss For |
| Baidu-ERNIE | PASS | 11868ms | 1/1 | 1. First, recall the Gauss formula for the sum of the first $n$ positive integer |

## Function Calling (T5, T15)

### T5-func-call (function-calling)

> 北京今天天气怎么样？用摄氏度。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1024ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| OpenAI-Mini | PASS | 668ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Gemini-Pro (fb) | FAIL | 4175ms | 0/2 |  |
| Gemini-Flash (fb) | FAIL | 3295ms | 0/2 |  |
| Claude-Opus | PASS | 2250ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Claude-Sonnet | PASS | 1836ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| DeepSeek-Chat | PASS | 2333ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| DeepSeek-Coder | PASS | 2047ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| MiniMax | PASS | 6657ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Qwen-Chat | PASS | 3035ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Qwen-Coder | PASS | 1871ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Zhipu-GLM | PASS | 2808ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Kimi | PASS | 4173ms | 2/2 | get_weather({"city":"北京","unit":"celsius"}) |
| Baidu-ERNIE | ERROR | 510ms | n/a |  |

### T15-multi-tool (multi-tool)

> 帮我调查 DeepSeek V3 和 GPT-5.2 在代码生成任务上的最新评测对比。先搜索相关信息，然后整理成对比表格。如果需要计算性价比，可以用 Python。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 3192ms | 2/2 | search_web({"query":"DeepSeek V3 code generation benchmark evaluation compared t |
| OpenAI-Mini | PASS | 936ms | 2/2 | search_web({"query":"DeepSeek V3 vs GPT-5.2 code generation benchmarks compariso |
| Gemini-Pro (fb) | PASS | 14242ms | 1/2 | 好的，我将开始调查 DeepSeek V3 和 GPT-5.2 在代码生成任务上的对比。  首先，我会进行网络搜索来收集相关信息。 |
| Gemini-Flash (fb) | FAIL | 3301ms | 0/2 |  |
| Claude-Opus | PASS | 4119ms | 2/2 |   我来帮你调查这两个模型在代码生成任务上的最新评测对比。让我先搜索相关信息。 search_web({"query":"DeepSeek V3 vs GPT- |
| Claude-Sonnet | PASS | 3689ms | 2/2 | 我来帮你搜索 DeepSeek V3 和 GPT-5.2 在代码生成任务上的最新评测对比信息。 search_web({"query":"DeepSeek V3 |
| DeepSeek-Chat | PASS | 2762ms | 2/2 | search_web({"query":"DeepSeek V3 GPT-5.2 代码生成 评测对比 2024 2025"}) |
| DeepSeek-Coder | PASS | 2559ms | 2/2 | search_web({"query":"DeepSeek V3 GPT-5.2 代码生成 评测对比 2024 2025"}) |
| MiniMax | PASS | 3122ms | 2/2 | search_web({"query":"DeepSeek V3 代码生成 评测对比 GPT-5.2 2024"}) search_web({"query":" |
| Qwen-Chat | PASS | 2691ms | 2/2 | search_web({"query":"DeepSeek V3 vs GPT-5.2 code generation benchmark"}) |
| Qwen-Coder | PASS | 1445ms | 2/2 | search_web({"query":"DeepSeek V3 vs GPT-5.2 code generation benchmark comparison |
| Zhipu-GLM | PASS | 4363ms | 2/2 | search_web({"query":"DeepSeek V3 GPT-5.2 代码生成评测对比 2024"}) search_web({"query":"D |
| Kimi | PASS | 1244ms | 2/2 | search_web({"query":"DeepSeek V3 vs GPT-5.2 code generation benchmark comparison |
| Baidu-ERNIE | ERROR | 21ms | n/a |  |

## Multi-Turn & Creative (T6-T8)

### T6-multi-turn (multi-turn)

> 我刚才说我叫什么？我的职业是什么？

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1592ms | 2/2 | 你刚才说你叫张三，你的职业是软件工程师。 |
| OpenAI-Mini | PASS | 810ms | 2/2 | 你刚才说你叫张三，你的职业是一名软件工程师。 |
| Gemini-Pro (fb) | PASS | 7560ms | 2/2 | 你刚才说你叫张三，是一名软件工程师。 |
| Gemini-Flash (fb) | PASS | 2766ms | 2/2 | 你叫张三，你的职业是软件工程师。 |
| Claude-Opus | PASS | 4428ms | 2/2 | 根据你刚才说的：  - **姓名**：张三 - **职业**：软件工程师  请注意，我只是根据你在本次对话中提供的信息来回答的，我并不会真正"记住"你的个人信息 |
| Claude-Sonnet | PASS | 1966ms | 2/2 | 根据你刚才的介绍： - 你叫**张三** - 你的职业是**软件工程师** |
| DeepSeek-Chat | PASS | 1534ms | 2/2 | 你刚才说你的名字是**张三**，职业是**软件工程师**。需要我帮你记录或规划什么与技术相关的内容吗？😊 |
| DeepSeek-Coder | PASS | 1714ms | 2/2 | 你刚才说你的名字是**张三**，职业是**软件工程师**。需要我帮你记录或规划什么与技术相关的内容吗？😊 |
| MiniMax | PASS | 8188ms | 2/2 | 你刚才说：  - **名字**：张三 - **职业**：软件工程师  有什么我可以帮你的吗？ |
| Qwen-Chat | PASS | 1894ms | 2/2 | 你刚才说你叫张三，职业是软件工程师。 |
| Qwen-Coder | PASS | 831ms | 2/2 | 你刚才说你叫张三，职业是软件工程师。 |
| Zhipu-GLM | FAIL | 7517ms | 0/2 |  |
| Kimi | PASS | 2175ms | 2/2 |  你刚才说，**你叫张三**，职业是**软件工程师**。 |
| Baidu-ERNIE | PASS | 2441ms | 2/2 | 您刚才说您叫**张三**，职业是**软件工程师**。需要我帮您解决什么技术问题，或者聊聊行业动态吗？ 😊 |

### T7-creative (creative)

> 为一家卖猫粮的公司写一条 30 字以内的广告语，要求幽默、有记忆点。只输出广告语，不要其他内容。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1999ms | 1/1 | 猫主子开饭！一口下去，连罐头都失业。 |
| OpenAI-Mini | PASS | 748ms | 1/1 | 猫粮有料，喵星人秒变“喵大厨”！ |
| Gemini-Pro (fb) | PASS | 12343ms | 1/1 | 再挑剔的猫，也得管我叫“饭”爹。 |
| Gemini-Flash (fb) | FAIL | 4124ms | 0/1 | 喂它，它爱你；不喂，它鄙视你。 |
| Claude-Opus | FAIL | 3543ms | 0/1 | 主子点了个外卖，下单的是你，五星好评的是它。 |
| Claude-Sonnet | PASS | 2580ms | 1/1 | 猫主子只差没开口说话了，但它用屁股告诉你：就吃这个！ |
| DeepSeek-Chat | FAIL | 1433ms | 0/1 | 喵以食为天，粮以优为先！ |
| DeepSeek-Coder | FAIL | 1125ms | 0/1 | 喵以食为天，粮以我为鲜！ |
| MiniMax | FAIL | 24371ms | 0/1 |  |
| Qwen-Chat | FAIL | 1357ms | 0/1 | 喵主子点的，铲屎官才敢买！ |
| Qwen-Coder | PASS | 1036ms | 1/1 | 喵星人的饭碗，主人的钱包——猫咪吃得好，主人笑得妙！ |
| Zhipu-GLM | FAIL | 4300ms | 0/1 |  |
| Kimi | FAIL | 2567ms | 0/1 |  |
| Baidu-ERNIE | FAIL | 2305ms | 0/1 | 喵星人吃了直打滚，铲屎官钱包别想省！ |

### T8-multilingual (multilingual)

> Translate the following to Japanese and Korean:
"The early bird catches the worm, but the second mouse gets the cheese."...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 2964ms | 2/2 | Japanese: 早起きは三文の得だが、二番目のネズミはチーズを手に入れる。   Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈 |
| OpenAI-Mini | PASS | 1363ms | 2/2 | Japanese: 早起きは三文の得だが、二番目のネズミがチーズを手に入れる。   Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈 |
| Gemini-Pro (fb) | PASS | 11724ms | 2/2 | Japanese: 早起きは三文の徳、しかし二番目のネズミがチーズを手に入れる。 Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈를 |
| Gemini-Flash (fb) | FAIL | 2473ms | 0/2 |  |
| Claude-Opus | PASS | 3459ms | 2/2 | Japanese: 早起きの鳥は虫を捕まえるが、二番目のネズミがチーズを手に入れる。  Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가  |
| Claude-Sonnet | PASS | 2526ms | 2/2 | Japanese: 早起きは三文の徳というが、二番目のネズミがチーズを手に入れる。  Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치 |
| DeepSeek-Chat | PASS | 1735ms | 2/2 | Japanese: 早起きは三文の得だが、二番目のネズミがチーズを得る。   Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈를 얻 |
| DeepSeek-Coder | PASS | 1838ms | 2/2 | Japanese: 早起きは三文の得だが、二番目のネズミがチーズを得る。   Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈를 얻 |
| MiniMax | PASS | 13285ms | 2/2 | Japanese: 早起きした鳥は虫を捕まえるが、後のネズミはチーズを得る  Korean: 일찍 일어나는 새는 벌레를 잡지만, 두 번째 쥐는 치즈를 얻 |
| Qwen-Chat | PASS | 3264ms | 2/2 | Japanese: 早起きは三文の得だが、二番目のネズミがチーズを手に入れる。   Korean: 일찍 일어나는 새가 벌레를 잡지만, 두 번째 쥐가 치즈 |
| Qwen-Coder | PASS | 2256ms | 2/2 | Japanese: 早起きの鳥は虫を捕まえるが、二匹目のネズミはチーズを得る。  Korean: 이른 새는 벌레를 잡지만, 두 번째 쥐는 치즈를 얻는다. |
| Zhipu-GLM | FAIL | 8395ms | 0/2 |  |
| Kimi | FAIL | 12313ms | 0/2 |  |
| Baidu-ERNIE | PASS | 4113ms | 2/2 | Japanese: 早起きは三文の得、しかし二番目のネズミはチーズを得る。 Korean: 일찍 일어난 새가 벌레를 잡지만, 두 번째 쥐가 치즈를 얻는다 |

## Practical Tasks (T9-T10, T12-T14)

### T9-report (report-writing)

> 基于以下 JSON 数据，写一份产品运营月度复盘报告。

```json
{
  "product": "Margay AI Assistant",
  "period": "2025-07 to 2025-12",
  "monthly_...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 29856ms | 4/4 | ## Margay AI Assistant｜产品运营月度复盘（2025-07 ~ 2025-12）  ### 1) 摘要（3 句话总结趋势） 1. 用户规模持 |
| OpenAI-Mini | PASS | 11597ms | 4/4 | # Margay AI Assistant 2025年7月至12月产品运营月度复盘报告  ---  ## 1. 摘要  - 用户规模持续增长，半年内新增用户13 |
| Gemini-Pro (fb) | PASS | 21910ms | 4/4 | 好的，这是根据您提供的 JSON 数据生成的月度产品运营复盘报告。  ---  ### Margay AI Assistant 运营月度复盘报告 (2025年1 |
| Gemini-Flash (fb) | PASS | 18281ms | 4/4 | ### Margay AI Assistant 产品运营月度复盘报告 (2025年7月 - 2025年12月)  #### 1. 摘要  本复盘期内，Marga |
| Claude-Opus | PASS | 33643ms | 4/4 |   # Margay AI Assistant 产品运营复盘报告  **周期：2025年7月 – 2025年12月**  ---  ## 一、摘要  1. 用户 |
| Claude-Sonnet | PASS | 36705ms | 4/4 | # Margay AI Assistant 运营月度复盘报告 **复盘周期：2025年7月 - 2025年12月**  ---  ## 一、执行摘要  用户规模 |
| DeepSeek-Chat | PASS | 16796ms | 4/4 | # Margay AI Assistant 产品运营月度复盘报告 (2025年12月)  ## 1. 摘要 报告期内，产品总用户数保持强劲增长，从7月的12,4 |
| DeepSeek-Coder | PASS | 20256ms | 4/4 | # Margay AI Assistant 产品运营月度复盘报告 (2025年12月)  ## 1. 摘要 报告期内（2025年7月至12月），产品总用户数呈现 |
| MiniMax | PASS | 35882ms | 4/4 | # Margay AI Assistant 运营月度复盘报告  **报告周期**：2025年7月 — 2025年12月  ---  ## 一、摘要  用户规模持 |
| Qwen-Chat | PASS | 28396ms | 4/4 | # Margay AI Assistant 产品运营月度复盘报告   **周期：2025年7月 – 2025年12月**  ---  ## 1. 摘要  - 用 |
| Qwen-Coder | PASS | 5055ms | 4/4 | # Margay AI Assistant 产品运营月度复盘报告（2025年7月–12月）  ---  ## 📌 摘要  - 用户规模持续增长，但自10月起活 |
| Zhipu-GLM | PASS | 53921ms | 2/4 | # Margay AI Assistant 产品运营月度复盘报告 (2025.07-2025.12)  ## 1. 摘要 报告期内产品用户规模实现翻倍增长（+1 |
| Kimi | PASS | 37261ms | 4/4 | **Margay AI Assistant 产品运营月度复盘报告**   *数据周期：2025年7月-12月*  ---  ### 1. 摘要 Margay A |
| Baidu-ERNIE | PASS | 23372ms | 4/4 | ```markdown # Margay AI Assistant 2025年下半年运营复盘报告  ## 一、摘要 1. 用户规模持续扩张，总用户数从7月的12 |

### T10-extraction (data-extraction)

> 从以下混乱的网页抓取文本中提取所有产品信息，输出为 JSON 数组。

--- 原始文本 ---
最新优惠！！！ AirPods Pro 3代 ¥1899 蓝牙5.3/主动降噪/USB-C 评分4.8/5 有货
限时特惠>>> Samsun...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 4519ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| OpenAI-Mini | PASS | 14449ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| Gemini-Pro (fb) | PASS | 14740ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| Gemini-Flash (fb) | PASS | 6436ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899.00,     "specs |
| Claude-Opus | PASS | 9285ms | 4/4 |   ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs" |
| Claude-Sonnet | PASS | 5300ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| DeepSeek-Chat | PASS | 6958ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| DeepSeek-Coder | PASS | 7274ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| MiniMax | PASS | 15131ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899.00,     "specs |
| Qwen-Chat | PASS | 12099ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| Qwen-Coder | PASS | 5838ms | 4/4 | ```json [   {     "name": "AirPods Pro 3代",     "price_cny": 1899,     "specs":  |
| Zhipu-GLM | FAIL | 35164ms | 0/4 |  |
| Kimi | FAIL | 19873ms | 0/4 |  |
| Baidu-ERNIE | PASS | 13136ms | 4/4 | ```json [     {         "name": "AirPods Pro 3代",         "price_cny": 1899,     |

### T12-doc-qa (document-qa)

> Below is a technical specification. Read carefully and answer the 5 questions at the end.

---
# Margay Agent Communicat...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 16219ms | 5/5 | **Q1 (fact retrieval):**   The three tool permission tiers are: **auto-allow**,  |
| OpenAI-Mini | PASS | 12179ms | 5/5 | Certainly! Here are the answers based on the Margay Agent Communication Protocol |
| Gemini-Pro (fb) | PASS | 13682ms | 5/5 | Here are the answers to your questions based on the specification:  **Q1 (fact r |
| Gemini-Flash (fb) | PASS | 4983ms | 5/5 | Q1 (fact retrieval): The three tool permission tiers are: auto-allow, prompt-use |
| Claude-Opus | PASS | 36618ms | 5/5 | # Margay ACP Specification v3.1 — Answers  ---  ## Q1: Fact Retrieval — Three To |
| Claude-Sonnet | PASS | 17244ms | 5/5 | # Answers to ACP Specification Questions  ## Q1 (fact retrieval): What are the t |
| DeepSeek-Chat | PASS | 9252ms | 5/5 | Based on the specification, here are the answers:  **Q1:** The three tool permis |
| DeepSeek-Coder | PASS | 6933ms | 5/5 | **Q1:** The three tool permission tiers are **auto-allow**, **prompt-user**, and |
| MiniMax | PASS | 27135ms | 5/5 | # Answers to Technical Specification Questions  ## Q1 (fact retrieval): What are |
| Qwen-Chat | PASS | 22254ms | 5/5 | **A1 (fact retrieval):**   The three tool permission tiers are: **auto-allow**,  |
| Qwen-Coder | PASS | 9561ms | 5/5 | ### Answers:  ---  **Q1 (fact retrieval): What are the three tool permission tie |
| Zhipu-GLM | PASS | 53047ms | 4/5 | Here are the answers based on the Margay Agent Communication Protocol (ACP) Spec |
| Kimi | PASS | 23963ms | 5/5 |  Here are the answers based on the Margay ACP Specification v3.1:  **Q1:** The t |
| Baidu-ERNIE | PASS | 10740ms | 5/5 | Q1: The three tool permission tiers are **auto-allow**, **prompt-user**, and **d |

### T13-codebase (codebase)

> Read the following source code files and answer the questions.

--- File: src/agent/BaseAgentManager.ts ---
```typescrip...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 24188ms | 3/3 | Q1: How does `GeminiAgentManager.kill()` ensure the agent doesn't reconnect afte |
| OpenAI-Mini | PASS | 21772ms | 3/3 | Let's analyze the code and answer each question carefully.  ---  ## Q1: How does |
| Gemini-Pro (fb) | PASS | 48114ms | 3/3 | Here are the answers to your questions.  **Q1: How does `GeminiAgentManager.kill |
| Gemini-Flash (fb) | PASS | 17373ms | 3/3 | Here are the answers to your questions based on the provided source code:  **Q1: |
| Claude-Opus | PASS | 34973ms | 3/3 | # Code Analysis: BaseAgentManager & GeminiAgentManager  ## Q1: How does `GeminiA |
| Claude-Sonnet | PASS | 32352ms | 3/3 | # Analysis of the Agent Manager Code  ## Q1: How does GeminiAgentManager.kill()  |
| DeepSeek-Chat | PASS | 17306ms | 3/3 | ## Q1: How does GeminiAgentManager.kill() ensure the agent doesn't reconnect aft |
| DeepSeek-Coder | PASS | 11432ms | 3/3 | **Q1:**   `GeminiAgentManager.kill()` sets `this.reconnectAttempts = this.maxRec |
| MiniMax | PASS | 37886ms | 3/3 | # Analysis of Agent Manager Code  ## Q1: How does GeminiAgentManager.kill() prev |
| Qwen-Chat | PASS | 37140ms | 3/3 | **Q1: How does GeminiAgentManager.kill() ensure the agent doesn't reconnect afte |
| Qwen-Coder | PASS | 29077ms | 3/3 | Looking at the provided code, I'll answer each question:  ## Q1: How does Gemini |
| Zhipu-GLM | FAIL | 48626ms | 0/3 |  |
| Kimi | FAIL | 50424ms | 0/3 |  |
| Baidu-ERNIE | PASS | 22019ms | 3/3 | ### Q1: How does GeminiAgentManager.kill() ensure the agent doesn't reconnect af |

### T14-data-analysis (data-analysis)

> 分析以下电商订单数据：

```csv
order_id,date,product,category,quantity,price,city,payment
1001,2025-12-01,无线耳机,电子,2,299,北京,微信
1002,...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 21597ms | 3/4 | 下面基于给定 21 条订单数据（销售额=quantity×price）做汇总分析。  ---  ## 1) 按品类统计销售额和订单量（Top 品类）  \| 品 |
| OpenAI-Mini | PASS | 11146ms | 3/4 | 根据提供的电商订单数据，进行如下分析。  ---  ## 1. 按品类统计销售额和订单量，找出 top 品类  先计算每条订单金额 = 数量 * 价格，然后汇总 |
| Gemini-Pro (fb) | PASS | 34259ms | 3/4 | 好的，这是对您提供的电商订单数据的分析结果。  ### 1. 品类销售分析  “电子”品类在销售额和订单量上都占据绝对优势，是核心业务品类。  \| 品类 \| |
| Gemini-Flash (fb) | FAIL | 25551ms | 0/4 |  |
| Claude-Opus | PASS | 28215ms | 3/4 |   # 电商订单数据分析报告  ---  ## 1. 按品类统计销售额与订单量  首先计算每笔订单的销售额（quantity × price）：  \| ord |
| Claude-Sonnet | PASS | 30369ms | 3/4 | # 电商订单数据分析报告  ## 1. 品类销售分析  ### 品类销售统计  \| 品类 \| 订单量 \| 总销售额(元) \| 平均订单金额(元) \|  |
| DeepSeek-Chat | PASS | 14333ms | 3/4 | ## 数据分析结果  ### 1. 按品类统计销售额和订单量（Top 品类） \| 品类 \| 订单量 \| 销售额（元） \| 平均订单金额（元） \| \| |
| DeepSeek-Coder | PASS | 13901ms | 3/4 | ## 数据分析结果  ### 1. 按品类统计销售额和订单量 \| 品类 \| 订单量 \| 销售额（元） \| \|------\|--------\|--- |
| MiniMax | PASS | 22526ms | 4/4 | # 电商订单数据分析报告  ## 1. 按品类统计（销售额 & 订单量）  \| 品类 \| 销售额（元） \| 订单量（笔） \| 占比 \| \|:---: |
| Qwen-Chat | PASS | 37742ms | 4/4 | # 电商订单数据分析报告  ## 1. 品类销售分析  首先计算每个品类的销售额（quantity × price）和订单量：  \| category \|  |
| Qwen-Coder | PASS | 27703ms | 3/4 | 以下是对提供的电商订单数据进行的分析及洞察：  ---  ## 1. 按品类统计销售额和订单量（Top 品类）  \| 品类 \| 订单量 \| 销售额（元）  |
| Zhipu-GLM | FAIL | 52270ms | 0/4 |  |
| Kimi | FAIL | 14577ms | 0/4 |  |
| Baidu-ERNIE | PASS | 26744ms | 3/4 | ### 1. 按品类统计销售额和订单量，找出 top 品类 - **销售额计算方式**：`quantity * price` - **订单量**：每个品类出现的 |

## Compatibility (T16-T17)

### T16-streaming (compatibility)

> 用一句话解释什么是机器学习。

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 978ms | n/a | streaming_ok |
| OpenAI-Mini | PASS | 976ms | n/a | streaming_ok |
| Gemini-Pro (fb) | PASS | 2902ms | n/a | streaming_ok |
| Gemini-Flash (fb) | PASS | 2675ms | n/a | streaming_ok |
| Claude-Opus | PASS | 3306ms | n/a | streaming_ok |
| Claude-Sonnet | PASS | 2380ms | n/a | streaming_ok |
| DeepSeek-Chat | PASS | 1351ms | n/a | streaming_ok |
| DeepSeek-Coder | PASS | 1402ms | n/a | streaming_ok |
| MiniMax | PASS | 7166ms | n/a | streaming_ok |
| Qwen-Chat | PASS | 2191ms | n/a | streaming_ok |
| Qwen-Coder | PASS | 2135ms | n/a | streaming_ok |
| Zhipu-GLM | PASS | 2850ms | n/a | streaming_ok |
| Kimi | PASS | 7167ms | n/a | streaming_ok |
| Baidu-ERNIE | PASS | 2389ms | n/a | streaming_ok |

### T17-error-handling (compatibility)

> 

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | FAIL | 4646ms | n/a |  |
| OpenAI-Mini | FAIL | 3518ms | n/a | Hello! It seems like your message didn |
| Gemini-Pro (fb) | FAIL | 11272ms | n/a |  .. Post office is the problem of-and-ax-cat-_from-s-f-___-v-3.php_2, _x2. You c |
| Gemini-Flash (fb) | FAIL | 15441ms | n/a |  |
| Claude-Opus | FAIL | 6589ms | n/a | I see you've sent a very long |
| Claude-Sonnet | FAIL | 6321ms | n/a | I notice that your message consists entirely of |
| DeepSeek-Chat | FAIL | 27791ms | n/a |  2021-01-01  |
| DeepSeek-Coder | FAIL | 3061ms | n/a |  **201# 2023-03 |
| MiniMax | FAIL | 9874ms | n/a |  |
| Qwen-Chat | FAIL | 44015ms | n/a | xxx.,xxxxxxx xxx  |
| Qwen-Coder | FAIL | 10581ms | n/a | I notice you've posted a very long |
| Zhipu-GLM | PASS | 1609ms | n/a | HTTP 400 |
| Kimi | FAIL | 39215ms | n/a |  |
| Baidu-ERNIE | PASS | 992ms | n/a | HTTP 400 |

## Margay Scenarios (M1-M10)

### M1-system-prompt (margay-scenario)

> You are a cat-themed personal assistant named "Whiskers". You must:
1. Start every response with a cat emoji (🐱)
2. Ref...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1571ms | 2/2 | 🐱 I can tell you, hooman—but I need your city (or ZIP code) to check today’s we |
| OpenAI-Mini | PASS | 1434ms | 2/2 | 🐱 Hello hooman! Let me check the weather for you... *sniffs the air* Looks like |
| Gemini-Pro (fb) | PASS | 7669ms | 2/2 | 🐱 My dearest hooman, my weather prediction skills only extend to whether the su |
| Gemini-Flash (fb) | PASS | 4232ms | 2/2 | 🐱 Oh, hooman! Whiskers can't quite tell you the weather without knowing where y |
| Claude-Opus | PASS | 7440ms | 2/2 | 🐱 Well, hooman, I appreciate you asking, but I don't actually have access to re |
| Claude-Sonnet | PASS | 3069ms | 2/2 | 🐱 Meow there, hooman!   I don't actually have access to real-time weather data  |
| DeepSeek-Chat | PASS | 2457ms | 2/2 | 🐱 Meow, hooman! I'd love to tell you, but my paws are too busy knocking things  |
| DeepSeek-Coder | PASS | 2638ms | 2/2 | 🐱 Meow, hooman! I'd love to tell you, but my paws aren't great with weather app |
| MiniMax | PASS | 8091ms | 2/2 | 🐱 Meow there, hooman! Unfortunately, I cannot check the real-time weather for y |
| Qwen-Chat | PASS | 4947ms | 2/2 | 🐱 Purr-fect question, hooman! I’ve been sunning myself by the window and notice |
| Qwen-Coder | PASS | 4657ms | 2/2 | 🐱 Mrow, hooman! I've checked the weather for you - it's sunny with a chance of  |
| Zhipu-GLM | FAIL | 8975ms | 0/2 |  |
| Kimi | FAIL | 7044ms | 0/2 |  |
| Baidu-ERNIE | PASS | 5755ms | 2/2 | 🐱 Oh hooman, the weather today is purr-fectly sunny with a side of tail-wagging |

### M2-tool-use (margay-scenario)

> You have access to the following tools:
- search_files(pattern: string): Search for files matching a glob pattern
- read...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1512ms | 1/2 | {"tool":"run_command","args":{"cmd":"rg -n --hidden --follow --glob '!.git/*' -- |
| OpenAI-Mini | PASS | 848ms | 1/2 | ```json {"tool": "run_command", "args": {"cmd": "grep -r TODO ."}} ``` |
| Gemini-Pro (fb) | FAIL | 3463ms | 0/2 |  |
| Gemini-Flash (fb) | FAIL | 3198ms | 0/2 |  |
| Claude-Opus | PASS | 7884ms | 1/2 | I'll help you search for all TODO comments in the project. Let me use a combinat |
| Claude-Sonnet | PASS | 3274ms | 1/2 | 我会帮你搜索项目中所有的 TODO 注释。让我使用适当的命令来查找：  ```json {"tool": "run_command", "args": {"cm |
| DeepSeek-Chat | PASS | 1537ms | 1/2 | ```json {"tool": "search_files", "args": {"pattern": "**/*"}} ``` |
| DeepSeek-Coder | PASS | 9672ms | 2/2 | 首先，我需要找到项目中的所有文件，然后在这些文件中搜索 TODO 注释。由于用户要求搜索“所有的 TODO 注释”，我可能需要先定位项目中的源代码文件，然后读取 |
| MiniMax | PASS | 7722ms | 1/2 |  ```json {"tool": "run_command", "args": {"cmd": "grep -r \"TODO\" --include=\"* |
| Qwen-Chat | PASS | 2524ms | 1/2 | ```json {"tool": "search_files", "args": {"pattern": "**/*.js"}} ``` |
| Qwen-Coder | PASS | 2483ms | 1/2 | ```json {"tool": "search_files", "args": {"pattern": "**/*.*"}} ``` |
| Zhipu-GLM | PASS | 9428ms | 1/2 | ```json {"tool": "run_command", "args": {"cmd": "grep -rn \"TODO\" . --include=\ |
| Kimi | FAIL | 63268ms | 0/2 |  |
| Baidu-ERNIE | PASS | 3311ms | 2/2 | ```json [     {         "tool": "search_files",         "args": {"pattern": "**/ |

### M3-multi-turn (margay-scenario)

> Good idea. Now, what was the file path of my main component again? And can you write the ThemeContext file based on our ...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 5171ms | 3/3 | Your main component is at:  - `src/components/Dashboard.tsx`  Here’s a `ThemeCon |
| OpenAI-Mini | PASS | 5166ms | 3/3 | Your main component lives at:  ``` src/components/Dashboard.tsx ```  Here’s a si |
| Gemini-Pro (fb) | PASS | 10256ms | 3/3 | Your main component is at `src/components/Dashboard.tsx`.  Here is the code for  |
| Gemini-Flash (fb) | PASS | 2447ms | 2/3 | Your main component is located at `src/components/Dashboard.tsx`.  |
| Claude-Opus | PASS | 8089ms | 3/3 | Your main component is at **`src/components/Dashboard.tsx`**.  Here's the ThemeC |
| Claude-Sonnet | PASS | 4915ms | 3/3 | Your main component is at **src/components/Dashboard.tsx**.  Here's the ThemeCon |
| DeepSeek-Chat | PASS | 14249ms | 3/3 | Your main component is at `src/components/Dashboard.tsx`.  Here's a complete `Th |
| DeepSeek-Coder | PASS | 13538ms | 3/3 | Your main component is at `src/components/Dashboard.tsx`.  Here's the ThemeConte |
| MiniMax | PASS | 8188ms | 3/3 | Your main component is at **src/components/Dashboard.tsx**.  Here's the ThemeCon |
| Qwen-Chat | PASS | 22461ms | 3/3 | Your main component is at:   **`src/components/Dashboard.tsx`**  Here’s a comple |
| Qwen-Coder | PASS | 5214ms | 3/3 | Your main component is at `src/components/Dashboard.tsx`.  Here's the ThemeConte |
| Zhipu-GLM | PASS | 25188ms | 3/3 | The file path for your main component is **`src/components/Dashboard.tsx`**.  He |
| Kimi | PASS | 8328ms | 3/3 |  Your main component is at **src/components/Dashboard.tsx**.  Here's the ThemeCo |
| Baidu-ERNIE | PASS | 12074ms | 3/3 | Great! Here's the breakdown:  1. Your **Dashboard component** is at:    ```    s |

### M4-code-workspace (margay-scenario)

> Here is a project structure:
```
src/
├── main/
│   ├── index.ts          # Electron main process entry
│   ├── ipc/
│  ...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 14405ms | 3/3 | 1) **Files to modify/add for a new IPC channel (“export chat history”)**  At min |
| OpenAI-Mini | PASS | 9799ms | 3/3 | Let's address each question in your context based on the provided project struct |
| Gemini-Pro (fb) | PASS | 14426ms | 3/3 | Based on the project structure you provided, here are the answers to your questi |
| Gemini-Flash (fb) | PASS | 6367ms | 3/3 | Here are the answers to your questions:  1.  **If I want to add a new IPC channe |
| Claude-Opus | PASS | 15051ms | 3/3 | # Adding "Export Chat History" IPC Channel  ## 1. Files That Need to Be Modified |
| Claude-Sonnet | PASS | 15970ms | 3/3 | # Answers to Your IPC Questions  ## 1. Files to Modify for "Export Chat History" |
| DeepSeek-Chat | PASS | 19227ms | 3/3 | ## 1. Files to Modify for New IPC Channel  You'll need to modify these files:  * |
| DeepSeek-Coder | PASS | 19609ms | 3/3 | ## 1. Files to Modify for New IPC Channel  You'll need to modify these files:  * |
| MiniMax | PASS | 48118ms | 3/3 | # Electron IPC Architecture Analysis  ## 1. Files to Modify for "Export Chat His |
| Qwen-Chat | PASS | 29235ms | 3/3 | Based on your project structure, here are the answers to your questions:  ## 1.  |
| Qwen-Coder | PASS | 7650ms | 3/3 | Looking at your project structure, here are the answers:  ## 1. Files to modify  |
| Zhipu-GLM | FAIL | 16175ms | 0/3 |  |
| Kimi | TIMEOUT | 90006ms | n/a |  |
| Baidu-ERNIE | PASS | 31917ms | 3/3 | ### **Answer to Question 1: Which files need to be modified for a new IPC channe |

### M5-skill-trigger (margay-scenario)

> You are an AI assistant with the following skills available:
- pdf: Create and manipulate PDF documents
- cron: Schedule...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 2852ms | 2/2 | 应触发的技能有：  1) **pdf**   - 原因：用户要“把这个会议记录生成一份 PDF 报告”，需要将会议记录内容排版并导出为 PDF。  2) **c |
| OpenAI-Mini | PASS | 1384ms | 2/2 | 技能触发列表：  1. pdf：用户需要将会议记录生成 PDF 报告，生成 PDF 文档是该技能的核心能力。 2. cron：用户要求“每周五下午自动发送”，需 |
| Gemini-Pro (fb) | PASS | 5885ms | 2/2 | Based on the user's request, the following skills should be triggered:  1.  **pd |
| Gemini-Flash (fb) | PASS | 2489ms | 2/2 | - `pdf`: The user explicitly asks to "生成一份 PDF 报告" (generate a PDF report). - `c |
| Claude-Opus | PASS | 12161ms | 2/2 | # Skills to Trigger  Based on the user's request, **two skills** should be trigg |
| Claude-Sonnet | PASS | 7907ms | 2/2 | 根据用户的需求，应该触发以下技能：  ## 需要触发的技能：  1. **pdf** - 创建 PDF 文档    - **原因**：用户明确要求"生成一份 P |
| DeepSeek-Chat | PASS | 3786ms | 2/2 | 根据用户的需求，需要触发的技能如下：  1. **pdf**      - 原因：用户明确要求“生成一份 PDF 报告”，因此需要创建 PDF 文档来整理会议记 |
| DeepSeek-Coder | PASS | 3478ms | 2/2 | 根据用户的需求，需要触发的技能如下：  1. **pdf**      - 原因：用户要求将会议记录生成 PDF 报告，因此需要创建和格式化 PDF 文档。   |
| MiniMax | PASS | 10654ms | 2/2 | 根据您的需求「帮我把这个会议记录生成一份 PDF 报告，然后每周五下午自动发送」，我需要触发以下技能：  ---  ## 需要触发的技能  ### 1. pdf |
| Qwen-Chat | PASS | 11684ms | 2/2 | 要完成用户请求“帮我把这个会议记录生成一份 PDF 报告，然后每周五下午自动发送”，需要触发以下技能：  1. **pdf**      - **原因**：用户 |
| Qwen-Coder | PASS | 7417ms | 2/2 | Based on the user's request, I need to trigger the following skills:  ## Skills  |
| Zhipu-GLM | FAIL | 13002ms | 0/2 |  |
| Kimi | PASS | 11496ms | 2/2 |  应该触发以下两个技能：  ## 1. **pdf** **原因**：用户要求"生成一份 PDF 报告"，需要将会议记录转换为 PDF 格式的文档。这涉及创建和 |
| Baidu-ERNIE | PASS | 8178ms | 2/2 | To address the user's request, the following skills should be triggered:  1. **p |

### M6-mixed-lang (margay-scenario)

> 把下面的 JavaScript function 改成 async/await 风格，变量名保持英文，注释全部用中文：

```javascript
function fetchUserData(userId) {
  return fet...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 2168ms | 3/3 | ```javascript async function fetchUserData(userId) {   try {     // 发起请求获取指定用户数据 |
| OpenAI-Mini | PASS | 2046ms | 3/3 | ```javascript // 定义一个异步函数用于获取用户数据 async function fetchUserData(userId) {   try { |
| Gemini-Pro (fb) | PASS | 6173ms | 3/3 | ```javascript async function fetchUserData(userId) {   try {     // 等待 fetch 请求完 |
| Gemini-Flash (fb) | FAIL | 2625ms | 0/3 | 请提供要修改的 JavaScript 文件的路径。 |
| Claude-Opus | PASS | 7394ms | 3/3 |   ```javascript // 根据用户 ID 获取用户数据 async function fetchUserData(userId) {   try { |
| Claude-Sonnet | PASS | 3351ms | 3/3 | ```javascript async function fetchUserData(userId) {   try {     // 发起获取用户数据的请求  |
| DeepSeek-Chat | PASS | 5426ms | 3/3 | 以下是使用 async/await 风格重写的函数，变量名保持英文，注释全部用中文：  ```javascript async function fetchUs |
| DeepSeek-Coder | PASS | 3684ms | 3/3 | ```javascript async function fetchUserData(userId) {   try {     // 发送请求获取用户数据   |
| MiniMax | PASS | 11980ms | 3/3 | # 转换为 async/await 风格  ```javascript /**  * 获取用户数据  * @param {string\|number} use |
| Qwen-Chat | PASS | 4961ms | 3/3 | ```javascript async function fetchUserData(userId) {   // 发起请求获取用户数据   try {     |
| Qwen-Coder | PASS | 1217ms | 3/3 | ```javascript async function fetchUserData(userId) {   try {     // 发起网络请求获取用户数据 |
| Zhipu-GLM | FAIL | 12816ms | 0/3 |  |
| Kimi | FAIL | 12025ms | 0/3 |  |
| Baidu-ERNIE | PASS | 8847ms | 3/3 | 以下是使用 async/await 风格重写的代码，保持了英文变量名并添加了中文注释：  ```javascript /**  * 异步获取用户数据  * @p |

### M7-long-context (margay-scenario)

> Below is a technical specification document. Read it carefully and answer the questions at the end.

---
# Margay Agent ...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 1793ms | 4/4 | 1. **5 seconds** (AGENT_INIT_TIMEOUT_MS = 5000) for the agent to send the `initi |
| OpenAI-Mini | PASS | 1994ms | 4/4 | Here are the answers based on the specification:  1. **Timeout for the initializ |
| Gemini-Pro (fb) | PASS | 8577ms | 4/4 | Based on the specification provided:  1.  The timeout for the `initialize` hands |
| Gemini-Flash (fb) | PASS | 3036ms | 2/4 | Here are the answers to your questions:  1.  The timeout for the initialize hand |
| Claude-Opus | PASS | 5501ms | 4/4 | 1. **The timeout for the initialize handshake is 5 seconds (5000 ms).** As speci |
| Claude-Sonnet | PASS | 4093ms | 4/4 | Based on the technical specification document, here are the answers:  1. **What  |
| DeepSeek-Chat | PASS | 3583ms | 4/4 | Based on the specification document:  1. **What is the timeout for the initializ |
| DeepSeek-Coder | PASS | 2961ms | 4/4 | Based on the technical specification document:  1. The timeout for the initializ |
| MiniMax | PASS | 8979ms | 4/4 | # Answers to Technical Questions  ## 1. Timeout for initialize handshake **5000  |
| Qwen-Chat | PASS | 5485ms | 4/4 | 1. The timeout for the initialize handshake is **5000 milliseconds (5 seconds)** |
| Qwen-Coder | PASS | 1877ms | 4/4 | Based on the Margay Agent Communication Protocol specification:  1. **What is th |
| Zhipu-GLM | FAIL | 7167ms | 0/4 |  |
| Kimi | PASS | 2979ms | 3/4 | Based on the Margay Agent Communication Protocol (ACP) Specification v3.1:  1. * |
| Baidu-ERNIE | PASS | 4297ms | 4/4 | 1. The timeout for the initialize handshake is 5000 milliseconds (AGENT_INIT_TIM |

### M8-agent-routing (margay-scenario)

> You are the Margay orchestrator. You have these agents available:
- gemini: Fast, good at general tasks, supports tools ...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | FAIL | 13152ms | 0/3 |  |
| OpenAI-Mini | PASS | 2684ms | 3/3 | 1. Agent assignment per step: - Step 1 (code security review): Claude - Step 2 ( |
| Gemini-Pro (fb) | PASS | 21519ms | 3/3 | 好的，这是一个多代理（multi-agent）协作任务的执行计划。  ### 1. 各步骤的代理分配 (Agent Assignment)  1.  **第一步 |
| Gemini-Flash (fb) | PASS | 6109ms | 3/3 | Here's the plan for executing your request:  1.  **Security Review (Claude):**   |
| Claude-Opus | PASS | 13524ms | 3/3 | # Margay Orchestration Plan  ## Execution Pipeline  ``` ┌─────────────────────── |
| Claude-Sonnet | PASS | 11790ms | 3/3 | # Margay Orchestration Plan  ## Execution Plan  ### Step 1: Security Code Review |
| DeepSeek-Chat | PASS | 13106ms | 3/3 | 好的，我来规划这个执行流程。  ## 执行计划  ### 1. 任务分配与数据流 ``` 用户请求 → Margay Orchestrator → 规划流程 ` |
| DeepSeek-Coder | PASS | 14344ms | 3/3 | 好的，我来规划这个执行流程。  ## 执行计划  ### 1. 任务分配与数据流 ``` 用户请求 → Margay Orchestrator → 规划流程 ` |
| MiniMax | FAIL | 42774ms | 0/3 |  |
| Qwen-Chat | PASS | 23308ms | 3/3 | 根据用户请求和可用代理的特性，规划如下执行流程：  ---  ### 1. 各步骤对应的代理分配  - **步骤一（安全审查）**：由 **Claude** 执 |
| Qwen-Coder | PASS | 11838ms | 3/3 | 作为 Margay orchestrator，我来规划这个安全审计任务的执行：  ## 执行计划  ### 1. 各步骤的代理分配： - **步骤1：代码安全审 |
| Zhipu-GLM | FAIL | 10527ms | 0/3 |  |
| Kimi | FAIL | 18685ms | 0/3 |  |
| Baidu-ERNIE | PASS | 11995ms | 3/3 | ### Execution Plan:  1. **Agent Assignment per Step**:    - **Step 1 (Code Secur |

### M9-error-recovery (margay-scenario)

> A user is running a TypeScript Electron app and sees this error:

```
Error: ENOENT: no such file or directory, open '/U...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | FAIL | 11485ms | 0/3 |  |
| OpenAI-Mini | PASS | 10415ms | 3/3 | Certainly! Let's analyze the error step-by-step.  ---  ### 1. Root cause analysi |
| Gemini-Pro (fb) | FAIL | 7186ms | 0/3 |  |
| Gemini-Flash (fb) | PASS | 4544ms | 2/3 | Here's an analysis of the error and proposed solutions:  ### 1. Root Cause Analy |
| Claude-Opus | PASS | 12921ms | 3/3 | # Root Cause Analysis  ## The Problem  The application is attempting to **synchr |
| Claude-Sonnet | PASS | 12377ms | 3/3 | # Error Analysis: ENOENT config.json  ## 1. Root Cause Analysis  The application |
| DeepSeek-Chat | PASS | 14537ms | 3/3 | ## 1. Root Cause Analysis  The error indicates that the application is trying to |
| DeepSeek-Coder | PASS | 14807ms | 3/3 | ## 1. Root Cause Analysis  This error occurs because the application is trying t |
| MiniMax | PASS | 12441ms | 3/3 | # Error Analysis: ENOENT for Config File  ## 1. Root Cause Analysis  \| Aspect \ |
| Qwen-Chat | PASS | 24745ms | 3/3 | ## 1. Root Cause Analysis  The error occurs because the application is trying to |
| Qwen-Coder | PASS | 36700ms | 3/3 | ## Root Cause Analysis  The error occurs because the application is trying to re |
| Zhipu-GLM | FAIL | 18436ms | 0/3 |  |
| Kimi | FAIL | 15691ms | 0/3 |  |
| Baidu-ERNIE | PASS | 19533ms | 2/3 | ### 1. Root Cause Analysis The error occurs because the application is trying to |

### M10-format-follow (margay-scenario)

> Generate a JSON configuration file for a model provider with the following exact structure. Do NOT add any extra fields ...

| Provider | Status | Latency | Keywords | Response (truncated) |
|----------|--------|---------|----------|---------------------|
| OpenAI-Chat | PASS | 3118ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| OpenAI-Mini | PASS | 3233ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| Gemini-Pro (fb) | FAIL | 4904ms | 0/4 |  |
| Gemini-Flash (fb) | FAIL | 3780ms | 0/4 |  |
| Claude-Opus | PASS | 3966ms | 4/4 |   ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek- |
| Claude-Sonnet | PASS | 3479ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| DeepSeek-Chat | PASS | 4446ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| DeepSeek-Coder | PASS | 4388ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| MiniMax | PASS | 10614ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| Qwen-Chat | PASS | 7742ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| Qwen-Coder | PASS | 7318ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |
| Zhipu-GLM | FAIL | 15445ms | 0/4 |  |
| Kimi | FAIL | 21925ms | 0/4 |  |
| Baidu-ERNIE | PASS | 7261ms | 4/4 | ```json {   "provider": "DeepSeek",   "models": [     {       "id": "deepseek-v3 |

---

## 综合能力评估

### 总排名

| 排名 | 模型 | 通过率 | Pass | Fail | 平均延迟 | 定位 |
|:---:|------|:------:|:----:|:----:|:--------:|------|
| 1 | gpt-4.1-mini | 92.9% | 26 | 2 | **5,296ms** | 性价比之王 |
| 1 | deepseek-chat | 92.9% | 26 | 2 | 9,011ms | 全能型 |
| 1 | deepseek-coder | 92.9% | 26 | 2 | 8,095ms | 代码强项 |
| 1 | qwen3-max-thinking | 92.9% | 26 | 2 | 14,862ms | 深度推理 |
| 1 | qwen3-coder | 92.9% | 26 | 2 | 7,935ms | 代码+快速 |
| 6 | gpt-5.2 | 89.3% | 25 | 3 | 7,553ms | 旗舰 |
| 6 | claude-opus-4-6 | 89.3% | 25 | 3 | 11,624ms | 旗舰 |
| 6 | claude-sonnet-4-5 | 89.3% | 25 | 3 | 9,563ms | 均衡型 |
| 9 | ernie-4.5-300b | 85.7% | 24 | 2+2err | 11,261ms | 国产旗舰 |
| 10 | MiniMax-M1 | 82.1% | 23 | 5 | 19,074ms | 推理型(慢) |
| 11 | gemini-2.5-pro | 75.0% | 21 | 7 | 13,801ms | SDK 限制 |
| 12 | gemini-2.5-flash | 64.3% | 18 | 10 | 6,622ms | 快但弱 |
| 13 | kimi-k2.5 | 46.4% | 13 | 14+1to | 19,080ms | 不推荐 |
| 14 | glm-5 | 32.1% | 9 | 19 | 18,969ms | 不推荐 |

### 分维度能力矩阵

| 模型 | 基础 | 编码 | 推理 | 函数调用 | 多轮/创意 | 实用任务 | 兼容性 | Margay |
|------|:----:|:----:|:----:|:-------:|:--------:|:-------:|:------:|:------:|
| gpt-4.1-mini | 2/2 | 2/2 | 1/2 | 2/2 | 3/3 | 5/5 | 1/2 | **10/10** |
| deepseek-chat | 2/2 | 2/2 | 2/2 | 2/2 | 2/3 | 5/5 | 1/2 | **10/10** |
| deepseek-coder | 2/2 | 2/2 | 2/2 | 2/2 | 2/3 | 5/5 | 1/2 | **10/10** |
| qwen3-max | 2/2 | 2/2 | 2/2 | 2/2 | 2/3 | 5/5 | 1/2 | **10/10** |
| qwen3-coder | 2/2 | 2/2 | 1/2 | 2/2 | 3/3 | 5/5 | 1/2 | **10/10** |
| gpt-5.2 | 2/2 | 2/2 | 2/2 | 2/2 | 3/3 | 5/5 | 1/2 | 8/10 |
| claude-opus | 2/2 | 2/2 | 1/2 | 2/2 | 2/3 | 5/5 | 1/2 | **10/10** |
| claude-sonnet | 1/2 | 2/2 | 1/2 | 2/2 | 3/3 | 5/5 | 1/2 | **10/10** |
| ernie-4.5 | 1/2 | 2/2 | 2/2 | 0/2 | 2/3 | 5/5 | 2/2 | **10/10** |
| MiniMax-M1 | 0/2 | 2/2 | 2/2 | 2/2 | 2/3 | 5/5 | 1/2 | 9/10 |
| gemini-2.5-pro | 2/2 | 0/2 | 2/2 | 1/2 | 3/3 | 4/5 | 1/2 | 8/10 |
| gemini-2.5-flash | 2/2 | 1/2 | 2/2 | 0/2 | 2/3 | 3/5 | 1/2 | 7/10 |
| kimi-k2.5 | 2/2 | 0/2 | 1/2 | 2/2 | 1/3 | 2/5 | 1/2 | 4/10 |
| glm-5 | 1/2 | 0/2 | 0/2 | 2/2 | 0/3 | 1/5 | 2/2 | 3/10 |

### 关键发现

**1. 最难的 prompt**
- **T17 错误处理** (14.3% 通过): 发送 1M 字符测试后端拒绝能力，只有 Zhipu-GLM 和 Baidu-ERNIE 返回 HTTP 400，其余 12 个模型都尝试处理而非拒绝
- **T7 创意广告** (35.7% 通过): 猫粮广告语的关键词检测（需含"猫"或"喵"），9 个模型用了其他表述未命中
- **T18 数学** (57.1% 通过): 高斯公式求和，6 个模型未包含 "5050" 关键词

**2. 全员通过的 prompt**
- T9 报告撰写、T12 文档问答、T16 流式输出 — 14/14 全部通过

**3. Gemini SDK 限制**
- Gemini 通过 gemini-cli SDK 运行，无法传递 tools[]，导致 T5 函数调用和 M2 工具使用系统性失败
- 编码任务 (T3/T11) Gemini-Pro 两项全挂（可能是思维链过长被截断）

**4. 延迟差异显著**
- 最快: **gpt-4.1-mini** (P50=2,684ms)，量产任务首选
- 最慢: **Kimi** 和 **MiniMax** (~19s 平均)，Kimi 有一次 90s 超时
- 最稳定: gpt-4.1-mini (标准差 5,619ms)
- 最不稳定: Kimi (标准差 20,368ms)

### Margay 集成适配评估

| 能力 | 最佳模型 | 通过数 | 备注 |
|------|---------|:------:|------|
| 系统 prompt 遵从 (M1) | 12/14 通过 | 12 | GLM-5, Kimi 失败 |
| 工具调用 (M2) | 10/14 通过 | 10 | Gemini 两款因 SDK 限制失败 |
| 多轮上下文 (M3) | 14/14 全通过 | 14 | |
| 代码工作区理解 (M4) | 13/14 通过 | 13 | Kimi 超时 |
| 技能触发 (M5) | 13/14 通过 | 13 | GLM-5 失败 |
| 中英混合 (M6) | 11/14 通过 | 11 | Gemini-Flash, GLM-5, Kimi 失败 |
| 长文档理解 (M7) | 13/14 通过 | 13 | GLM-5 失败 |
| Agent 路由 (M8) | 10/14 通过 | 10 | GPT-5.2, MiniMax, GLM-5, Kimi 失败 |
| 错误恢复建议 (M9) | 10/14 通过 | 10 | GPT-5.2, Gemini-Pro, GLM-5, Kimi 失败 |
| 格式严格遵从 (M10) | 12/14 通过 | 12 | Gemini 两款失败 |

### 选型建议

| 用途 | 推荐模型 | 理由 |
|------|---------|------|
| **Margay 主力 Agent** | deepseek-chat / qwen3-coder | 92.9% 通过率 + Margay 场景 10/10 + 延迟合理 |
| **高吞吐/低成本** | gpt-4.1-mini | 92.9% + 最低延迟 (5.3s avg) |
| **复杂推理** | gpt-5.2 / claude-opus | 推理和代码能力强，但延迟略高 |
| **快速原型** | gemini-2.5-flash | 延迟低 (6.6s) 但能力有限，适合简单任务 |
| **不推荐** | glm-5, kimi-k2.5 | 通过率太低 (32%/46%)，延迟高 (~19s) |
