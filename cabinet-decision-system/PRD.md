# PRD: Cabinet Decision System (内阁决策系统)

> Version: 1.0  
> Date: 2026-05-11  
> Author: Product Team

---

## 1. Background & Problem Statement

### 1.1 Background
人们在面对复杂决策时，往往只能听到单一视角的观点。而现实中，优秀的决策通常来自于多元视角的碰撞。Cabinet Decision System 通过模拟六位现实世界知名人士的"内阁会议"，为用户提供多角度、深度的决策分析体验。

### 1.2 Problem Statement
- **用户痛点**: 面对重要决策时，普通人缺乏系统性获取多元视角的渠道。查阅资料耗时、咨询专家成本高、网络信息碎片化。
- **现有方案缺陷**: AI 助手虽然能快速回答，但通常是单一视角的综合性回复，缺乏不同立场之间的交锋与辩论。
- **产品机会**: 利用多 Agent 协作模拟"圆桌辩论"，让用户在一个界面中看到不同思维框架的碰撞过程。

### 1.3 Target Users
| 用户类型 | 描述 | 使用场景 |
|---------|------|---------|
| 决策者 | 创业者、管理者、投资人 | 重大决策前听取多元意见 |
| 学习者 | 学生、研究者 | 学习不同思想家的思维方式 |
| 好奇者 | 普通用户 | 趣味性地探索"名人怎么看这个问题" |

---

## 2. Goals & Success Metrics

### 2.1 Product Goals
1. **多元视角**: 每个问题至少呈现 6 种不同视角的分析
2. **深度讨论**: 通过交叉辩论展现思维碰撞，而非简单的观点罗列
3. **用户体验**: 实时展示讨论过程，让用户"身临其境"地旁观一场虚拟内阁会议

### 2.2 Success Metrics
| 指标 | 目标值 | 说明 |
|-----|-------|------|
| 单次讨论完整率 | >80% | 用户完整看完一轮讨论的比例 |
| 平均讨论时长 | >2 分钟 | 用户停留时长反映参与度 |
| 人均提问数 | >3 次/会话 | 重复使用意愿 |
| 分享率 | >5% | 讨论结果被分享的比例 |

---

## 3. Feature Specifications

### 3.1 Core Features

#### F1: 内阁成员展示
- **描述**: 首页展示 6 位内阁成员的卡片，包含头像、姓名、头衔、核心理念
- **Acceptance Criteria**:
  - [ ] 6 张卡片并排展示，hover 时显示详细人设摘要
  - [ ] 点击卡片可查看完整人设文档（独立页面/弹窗）
  - [ ] 每位成员有独特的配色方案

#### F2: 用户提问
- **描述**: 用户在输入框中输入问题，触发内阁讨论
- **Acceptance Criteria**:
  - [ ] 输入框支持多行文本，最多 2000 字
  - [ ] 提供 3 个示例问题供快速体验
  - [ ] 提交后显示讨论加载动画

#### F3: 三轮讨论流程
- **描述**: 完整的讨论流程包含三轮发言 + 主持人总结
- **Acceptance Criteria**:
  - [ ] 第一轮：6 位成员依次发表初始观点（每人一段完整论述）
  - [ ] 第二轮：交叉辩论阶段
    - 每位成员至少挑战 1 位其他成员的观点
    - 被挑战方必须回应
    - 主持人控制发言顺序，确保覆盖所有人
  - [ ] 第三轮：每位成员基于讨论修正/深化自己的观点
  - [ ] 最终：中立主持人综合总结，提炼共识与分歧
  - [ ] 每轮之间有明显的阶段分隔视觉提示

#### F4: 实时流式展示
- **描述**: 用户在前端实时看到讨论逐字生成，如同观看现场会议
- **Acceptance Criteria**:
  - [ ] 当前发言者高亮显示，其他人灰显
  - [ ] 打字效果动画 + 光标闪烁
  - [ ] 显示 "XXX 正在思考..." 的等待状态
  - [ ] 自动滚动到最新内容
  - [ ] 用户可以暂停/恢复自动滚动

#### F5: 讨论历史
- **描述**: 保存并展示过往讨论记录
- **Acceptance Criteria**:
  - [ ] 列表形式展示历史讨论，含标题、时间、摘要
  - [ ] 支持搜索和按时间筛选
  - [ ] 点击可回顾完整讨论内容
  - [ ] 支持删除历史记录

#### F6: AI 供应商配置
- **描述**: 支持切换不同 AI 后端
- **Acceptance Criteria**:
  - [ ] 支持 Claude API (Anthropic)
  - [ ] 支持 OpenAI API
  - [ ] 支持 Ollama 本地模型
  - [ ] 用户可在设置页配置 API Key 和模型
  - [ ] 提供连接测试功能
  - [ ] 切换时显示兼容性提示

### 3.2 Enhanced Features

#### F7: 讨论导出与分享
- **描述**: 用户可将讨论结果导出为文本或图片
- **Acceptance Criteria**:
  - [ ] 导出为 Markdown 文件
  - [ ] 导出为长图片（含排版美化）
  - [ ] 生成分享链接（可选公开/私密）

#### F8: 自定义内阁成员
- **描述**: V2 阶段允许用户自定义替换部分内阁成员
- **Acceptance Criteria**:
  - [ ] 用户可从预设候选库中选择替换成员
  - [ ] 支持自定义成员名称和简要描述
  - [ ] 系统自动生成完整人设

#### F9: 讨论主题分类
- **描述**: 自动识别问题所属领域并高亮相关专家
- **Acceptance Criteria**:
  - [ ] 自动分类：商业/科技/伦理/教育/政治/生活
  - [ ] 相关领域专家的卡片在讨论中高亮

---

## 4. User Flows

### 4.1 核心流程: 发起讨论

```
用户进入首页
    │
    ▼
浏览内阁成员卡片 (可选: 查看人设详情)
    │
    ▼
在输入框输入问题 (或选择示例问题)
    │
    ▼
点击「开始讨论」
    │
    ▼
页面跳转至讨论视图
    │
    ├── ▶ 阶段一: 开场陈述 (6人依次发言)
    │       用户实时看到每位成员观点生成
    │
    ├── ▶ 阶段二: 交叉辩论
    │       A挑战B → B回应 → C挑战D → D回应 → ...
    │       每轮辩论实时流式展示
    │
    ├── ▶ 阶段三: 观点修正
    │       每位成员基于讨论更新立场
    │
    └── ▶ 阶段四: 主持人总结
            综合所有观点，提炼共识与分歧
    │
    ▼
讨论完成 → 用户可:
    ├── 发起新讨论
    ├── 导出/分享结果
    └── 查看历史记录
```

### 4.2 设置流程

```
用户点击「设置」
    │
    ▼
选择 AI 供应商 (Claude / OpenAI / Ollama)
    │
    ▼
输入 API Key / 模型名称 / 服务地址
    │
    ▼
点击「测试连接」
    │
    ▼
显示测试结果 (成功/失败原因)
    │
    ▼
保存配置
```

---

## 5. Information Architecture

```
/
├── / (首页 / 仪表盘)
│   ├── 内阁成员卡片展示区
│   ├── 问题输入区 (含示例问题)
│   └── 最近讨论列表
│
├── /discussion/[id] (讨论详情页)
│   ├── 讨论标题和问题
│   ├── 实时讨论时间线
│   │   ├── 轮次分隔线
│   │   ├── 发言气泡 (按发言人着色)
│   │   └── 打字状态指示器
│   └── 操作按钮 (新讨论 / 导出 / 分享)
│
├── /members (内阁成员列表)
│   ├── 成员网格视图
│   └── 点击 → 成员详情弹窗/页面
│       ├── 头像 & 基本信息
│       ├── 人设文档
│       └── 历史发言统计
│
├── /history (讨论历史)
│   ├── 搜索框
│   ├── 筛选器 (时间 / 领域)
│   └── 讨论列表 (标题 / 时间 / 摘要)
│
└── /settings (设置)
    ├── AI 供应商配置
    │   ├── Claude API 配置
    │   ├── OpenAI API 配置
    │   └── Ollama 配置
    ├── 外观设置 (主题 / 语言)
    └── 数据管理 (清除历史)
```

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────┐
│                  Next.js App                      │
│  ┌──────────────┐    ┌─────────────────────────┐ │
│  │   Frontend    │    │    Backend (API Routes)  │ │
│  │              │    │                          │ │
│  │  - React     │◄──►│  - /api/chat (SSE)       │ │
│  │  - Tailwind  │    │  - /api/discussions      │ │
│  │  - Framer    │    │  - /api/config           │ │
│  │    Motion    │    │                          │ │
│  └──────────────┘    │  ┌────────────────────┐  │ │
│                      │  │  Agent Orchestrator │  │ │
│                      │  │                     │  │ │
│                      │  │  - Moderator Agent  │  │ │
│                      │  │  - 6 Member Agents  │  │ │
│                      │  │  - Round Manager    │  │ │
│                      │  └─────────┬───────────┘  │ │
│                      └────────────┼─────────────┘ │
└───────────────────────────────────┼───────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
              │ Claude API  │ │ OpenAI API  │ │  Ollama    │
              │ (Anthropic) │ │  (Microsoft) │ │  (Local)   │
              └─────────────┘ └─────────────┘ └────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    SQLite (Turso)    │
                         │  - Discussions       │
                         │  - Messages          │
                         │  - Config            │
                         └─────────────────────┘
```

### 6.2 Key Technical Decisions

| 决策 | 选择 | 原因 |
|-----|------|------|
| 框架 | Next.js 14+ App Router | 全栈一体化，SSR 友好，API Routes 内置 |
| 实时通信 | Server-Sent Events (SSE) | 单向流式推送足够，比 WebSocket 简单 |
| 样式 | Tailwind CSS + shadcn/ui | 快速开发，组件质量高，主题支持好 |
| 动画 | Framer Motion | React 生态最成熟的动画库 |
| 存储 | SQLite (via better-sqlite3) | 轻量级，适合个人/小规模使用 |
| AI 抽象层 | 统一 Provider Interface | 支持多供应商切换，降低耦合 |

### 6.3 AI Provider Abstraction Layer

```typescript
interface AIProvider {
  name: string;
  chatCompletion(params: {
    messages: Message[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): AsyncIterable<string>;
}

// 实现: ClaudeProvider, OpenAIProvider, OllamaProvider
// 通过工厂模式根据配置选择 provider
```

---

## 7. Discussion Protocol

### 7.1 完整消息流

```
用户提问 → Moderator 接收
    │
    ▼ [Round 1: Opening Statements]
    │
    Moderator → 系统提示词: "你是会议主持人，请引导每位成员发言"
    │
    Member 1 → 发表初始观点 (流式返回)
    Member 2 → 发表初始观点 (流式返回)
    ...
    Member 6 → 发表初始观点 (流式返回)
    │
    ▼ [Round 2: Cross-Examination]
    │
    Moderator → 分析 Round 1 内容，确定挑战配对
    │
    Member A → "我不同意 Member B 关于...的观点，理由是..."
    Member B → 回应挑战: "我理解你的担忧，但..."
    Member C → "Member D 忽略了...这一点"
    Member D → 回应挑战
    Member E → "我想补充 Member F 的看法..."
    Member F → 回应
    │
    ▼ [Round 3: Refined Positions]
    │
    Member 1 → 基于讨论修正观点
    Member 2 → 基于讨论修正观点
    ...
    Member 6 → 基于讨论修正观点
    │
    ▼ [Final: Moderator Summary]
    │
    Moderator → 综合总结:
      - 核心共识点
      - 主要分歧点
      - 各方核心论据摘要
      - 对用户的建议框架
```

### 7.2 System Prompt 设计

**Moderator Prompt:**
```
你是一个中立的会议主持人。你的职责是：
1. 引导6位内阁成员就用户提出的问题进行讨论
2. 确保每位成员都有发言机会
3. 在交叉辩论阶段，识别观点冲突并引导讨论
4. 最终总结各方共识与分歧
5. 保持中立，不表达个人立场
```

**Member Prompt Template:**
```
你是 {name}。请以你的身份、思维方式和说话风格来回答问题。

## 你的身份
{biography}

## 你的核心价值观
{core_values}

## 你的决策框架
{decision_framework}

## 你的说话风格
{speaking_style}

## 你的典型偏见和盲点
{biases}

## 历史讨论中的典型观点
{historical_views}

用户的问题: {user_question}

当前轮次: {round_info}
其他成员的观点: {others_views} (Round 2/3 时提供)

请给出你的回答:
```

### 7.3 Error Handling

| 场景 | 处理方式 |
|-----|---------|
| AI API 超时 | 重试 2 次，失败后跳过该成员本轮发言并提示用户 |
| Rate Limit | 显示等待动画，自动重试（指数退避，最多 3 次） |
| 内容安全过滤 | 跳过该发言，显示"该成员的观点未能通过内容审核" |
| 网络断开 | 暂停讨论，显示重连提示，恢复后继续 |
| Token 超限 | 自动压缩历史上下文（保留摘要） |

---

## 8. Persona Specifications

### 8.1 人设文档模板

每位内阁成员的人设文档包含以下字段：

| 字段 | 说明 | 示例 |
|-----|------|------|
| name | 姓名 | Warren Buffett |
| displayName | 显示名称 | 沃伦·巴菲特 |
| title | 头衔 | "奥马哈先知" / 价值投资之父 |
| avatar | 头像 URL | /avatars/buffett.png |
| color | 代表色 | #1A73E8 |
| biography | 生平简介 (200字) | ... |
| coreValues | 核心价值观 (3-5条) | ... |
| decisionFramework | 决策框架 | ... |
| speakingStyle | 说话风格描述 | ... |
| biases | 已知偏见 | ... |
| catchphrases | 口头禅/名言 (3-5条) | ... |
| historicalViews | 对典型议题的历史观点 | ... |
| systemPrompt | 完整系统提示词 | ... |

### 8.2 内阁成员清单

| 序号 | 成员 | 代表视角 | 配色 |
|-----|------|---------|------|
| 1 | 沃伦·巴菲特 | 价值投资、长期主义、商业智慧 | 蓝色 #1A73E8 |
| 2 | 埃隆·马斯克 | 第一性原理、创新、冒险精神 | 红色 #E53E3E |
| 3 | 安格拉·默克尔 | 务实政治、科学决策、危机管理 | 绿色 #38A169 |
| 4 | 尤瓦尔·赫拉利 | 宏大叙事、人类命运、技术伦理 | 紫色 #805AD5 |
| 5 | 克里斯蒂娜·拉加德 | 宏观经济、国际金融秩序、全球治理 | 金色 #D69E2E |
| 6 | 潘基文 | 多边主义、全球治理、气候变化 | 深灰 #2D3748 |

---

## 9. Edge Cases & Error Handling

### 9.1 异常场景

| 场景 | 处理策略 |
|-----|---------|
| 用户问题过于模糊 | Moderator 先引导用户澄清问题 |
| 用户问题敏感/违规 | 显示内容安全提示，拒绝处理 |
| 讨论中途离开页面 | 后台继续，完成后保存，用户返回可查看 |
| 讨论时间过长 (>10min) | 显示进度条，提示预计剩余时间 |
| 空问题提交 | 前端拦截，显示输入提示 |
| 并发讨论请求 | 队列化处理，同时显示排队状态 |

### 9.2 性能边界

| 指标 | 限制 |
|-----|------|
| 最大问题长度 | 2000 字 |
| 单次讨论最大 Token 消耗 | 50,000 tokens |
| 讨论超时时间 | 5 分钟 |
| 同时进行的讨论数 | 最多 3 个 |

---

## 10. Non-Functional Requirements

### 10.1 Performance
- 首屏加载时间 < 2 秒
- SSE 消息延迟 < 500ms
- 讨论历史列表加载 < 1 秒

### 10.2 Security
- API Key 存储在客户端 localStorage（不上传服务器）
- API 调用全部走服务端 Route Handler
- XSS 防护：所有用户输入经过 React 自动转义

### 10.3 Cost Management
- 显示每次讨论的预估 Token 消耗
- 设置每月使用上限提醒
- 支持 Ollama 本地模式降低云端成本

### 10.4 Accessibility
- WCAG 2.1 AA 级合规
- 键盘导航完整支持
- 屏幕阅读器友好（ARIA 标签）
- 色盲友好的配色方案

---

## 11. Phased Rollout Plan

### Phase 1: MVP (Week 1-2)

**目标**: 验证核心讨论流程可行

- [ ] 基础 Next.js 项目搭建
- [ ] 6 位内阁成员人设文档 (Markdown)
- [ ] 单一 AI 供应商支持 (Claude API)
- [ ] 首页 + 问题输入 + 讨论视图
- [ ] 三轮讨论流程实现
- [ ] SSE 实时流式展示
- [ ] 基础响应式布局

### Phase 2: V1 (Week 3-4)

**目标**: 完善用户体验和功能

- [ ] 多 AI 供应商支持 (OpenAI + Ollama)
- [ ] 讨论历史存储与回顾
- [ ] 设置页面 (API 配置)
- [ ] Dark/Light 主题切换
- [ ] 打字动画和交互优化
- [ ] 讨论导出功能
- [ ] 成员详情弹窗

### Phase 3: V2 (Week 5-6)

**目标**: 增强功能和内容质量

- [ ] 讨论质量优化 (更好的 system prompts)
- [ ] 自定义内阁成员
- [ ] 讨论主题自动分类
- [ ] 分享功能 (链接生成)
- [ ] 讨论性能监控
- [ ] 移动端适配

---

## 12. Open Questions

1. **Token 成本控制**: 一次完整讨论的 Token 消耗量可能较大 (6人 × 3轮 × 平均500 tokens ≈ 9,000+ tokens)，是否需要提供"精简模式"?
2. **内容审核**: 当用户提出敏感问题时，如何平衡自由表达和内容安全?
3. **人设准确性**: 历史人物的观点如何确保不产生误导性引用? 是否需要免责声明?
4. **多语言支持**: 首期是否只支持中文? 是否需要考虑英文用户的界面?
5. **数据隐私**: 讨论历史是否加密存储? 是否需要用户账户体系?
6. **Ollama 模型选择**: 哪些本地模型能较好地扮演历史人物角色? 需要实测验证。

---

## Appendix A: Project Structure

```
cabinet-decision-system/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # 首页
│   ├── discussion/[id]/page.tsx          # 讨论详情页
│   ├── members/page.tsx                  # 成员列表页
│   ├── history/page.tsx                  # 历史页
│   ├── settings/page.tsx                 # 设置页
│   └── api/
│       ├── chat/route.ts                 # SSE 流式接口
│       ├── discussions/route.ts          # 讨论 CRUD
│       └── config/route.ts               # 配置管理
├── components/
│   ├── cabinet/
│   │   ├── MemberCard.tsx                # 成员卡片
│   │   ├── MemberDetail.tsx              # 成员详情
│   │   └── MemberGrid.tsx                # 成员网格
│   ├── discussion/
│   │   ├── DiscussionView.tsx            # 讨论主视图
│   │   ├── MessageBubble.tsx             # 发言气泡
│   │   ├── RoundDivider.tsx              # 轮次分隔
│   │   ├── TypingIndicator.tsx           # 打字指示器
│   │   └── ProgressBar.tsx               # 进度条
│   ├── common/
│   │   ├── Header.tsx                    # 顶部导航
│   │   ├── InputArea.tsx                 # 输入区域
│   │   └── ThemeToggle.tsx               # 主题切换
│   └── settings/
│       ├── ProviderConfig.tsx             # 供应商配置
│       └── ConnectionTest.tsx             # 连接测试
├── lib/
│   ├── ai/
│   │   ├── provider.ts                   # Provider 抽象接口
│   │   ├── claude-provider.ts            # Claude 实现
│   │   ├── openai-provider.ts            # OpenAI 实现
│   │   └── ollama-provider.ts            # Ollama 实现
│   ├── agents/
│   │   ├── moderator.ts                  # 主持人 Agent
│   │   ├── cabinet-member.ts             # 内阁成员 Agent
│   │   ├── orchestrator.ts               # 讨论编排器
│   │   └── round-manager.ts              # 轮次管理器
│   ├── db/
│   │   ├── schema.ts                     # 数据库 schema
│   │   └── queries.ts                    # 查询函数
│   └── utils.ts                          # 工具函数
├── data/
│   └── personas/                         # 人设文档
│       ├── buffett.md
│       ├── musk.md
│       ├── curie.md
│       ├── mandela.md
│       ├── jobs.md
│       └── confucius.md
├── styles/
│   └── globals.css
├── public/
│   └── avatars/                          # 头像图片
├── prisma/
│   └── schema.prisma                     # 数据库模型
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```
