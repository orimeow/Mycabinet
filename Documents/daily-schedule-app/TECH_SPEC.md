# Scram（滚蛋计划）- 技术方案文档

## 1. 技术栈选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | Expo (React Native) | SDK 52+ | 统一构建工具，简化 iOS 原生配置 |
| **语言** | TypeScript | 5.x | 类型安全，便于多 agent 协作 |
| **数据库** | WatermelonDB | 0.28+ | 基于 SQLite 的反应式数据库，懒加载性能优秀 |
| **导航** | Expo Router | 4.x | 基于文件系统的路由，支持 Stack + Tab |
| **状态管理** | WatermelonDB Observable + React Context | - | 数据库直接提供 Observable，无需 Redux |
| **动画** | react-native-reanimated | 3.x | 60fps 动画，打卡/吐槽/周报动效 |
| **手势** | react-native-gesture-handler | 2.x | 左滑删除、下拉刷新、拖拽排序 |
| **通知** | expo-notifications | 最新 | 本地通知 + 远程推送 |
| **后台任务** | expo-background-fetch + expo-task-manager | 最新 | 自动延期引擎触发 |
| **AI** | @anthropic-ai/sdk | 最新 | Claude API 调用 |
| **文件选择** | expo-document-picker | 最新 | Markdown 文件导入 |
| **日期处理** | date-fns | 3.x | 轻量级日期计算 |
| **UI 组件** | react-native + 自定义组件 | - | 不引入重量级 UI 库，保持设计自由度 |
| **渐变** | expo-linear-gradient | 最新 | 糖果色渐变卡片和按钮 |
| **图标** | @expo/vector-icons (SF Symbols) | 最新 | iOS 系统图标 |

---

## 2. 项目目录结构

```
daily-schedule-app/
├── app/                          # Expo Router 文件系统路由
│   ├── (tabs)/                   # 底部 Tab 路由组
│   │   ├── _layout.tsx           # Tab Bar 配置
│   │   ├── index.tsx             # 📅 今天（首页）
│   │   ├── weekly.tsx            # 📊 周报
│   │   ├── calendar.tsx          # 📆 日历
│   │   └── projects.tsx          # 📁 项目
│   ├── project/
│   │   ├── [id].tsx              # 项目详情页
│   │   ├── [id]/edit.tsx         # 编辑项目
│   │   └── new.tsx               # 创建项目
│   ├── milestone/
│   │   ├── new.tsx               # 创建里程碑
│   │   └── [id]/edit.tsx         # 编辑里程碑
│   ├── subtask/
│   │   ├── new.tsx               # 创建子任务
│   │   └── [id]/edit.tsx         # 编辑子任务
│   ├── task/
│   │   └── [id].tsx              # 任务实例详情页
│   ├── weekly/
│   │   └── [id].tsx              # 历史周报详情
│   ├── ai-decompose.tsx          # AI 项目拆解引导页
│   ├── import-markdown.tsx       # Markdown 导入页
│   ├── settings/
│   │   ├── roast.tsx             # 吐槽设置
│   │   └── notification.tsx      # 通知设置
│   └── _layout.tsx               # 根布局（数据库初始化、主题）
│
├── src/
│   ├── api/
│   │   ├── claude.ts             # Claude API 封装（AI 拆解）
│   │   └── types.ts              # AI 请求/响应类型定义
│   │
│   ├── components/               # 可复用 UI 组件
│   │   ├── TaskCard.tsx          # 任务卡片（四种状态）
│   │   ├── ProjectCard.tsx       # 项目卡片
│   │   ├── RoastBubble.tsx       # 吐槽气泡
│   │   ├── ProgressBar.tsx       # 进度条
│   │   ├── RatingBadge.tsx       # 评级徽章（SSS-D）
│   │   ├── PraiseModal.tsx       # 夸夸弹窗
│   │   ├── EmptyState.tsx        # 空状态插画
│   │   ├── Skeleton.tsx          # 骨架屏
│   │   ├── DeferralModal.tsx     # 延期时间调整弹窗
│   │   └── WeekCalendar.tsx      # 周度日历组件
│   │
│   ├── db/
│   │   ├── schema.ts             # 数据表定义
│   │   ├── index.ts              # 数据库初始化
│   │   ├── migrations.ts         # 数据库迁移
│   │   └── hooks.ts              # useProjects, useTaskInstances 等 hooks
│   │
│   ├── services/                 # 核心业务逻辑
│   │   ├── rolloverEngine.ts     # 自动延期引擎
│   │   ├── roastEngine.ts        # 吐槽模板引擎
│   │   ├── praiseEngine.ts       # 夸夸引擎
│   │   ├── weeklyReport.ts       # 周结算系统
│   │   ├── notificationService.ts # 通知管理
│   │   ├── taskScheduler.ts      # 任务状态调度（自动开始等）
│   │   └── markdownParser.ts     # Markdown 解析器
│   │
│   ├── theme/
│   │   ├── colors.ts             # 颜色 token
│   │   ├── typography.ts         # 字体 token
│   │   ├── spacing.ts            # 间距 token
│   │   ├── borderRadius.ts       # 圆角 token
│   │   └── index.ts              # 统一导出 + useTheme hook
│   │
│   ├── utils/
│   │   ├── date.ts               # 日期计算（周/日/时间段）
│   │   ├── taskType.ts           # 任务类型标签推断
│   │   ├── template.ts           # 模板字符串渲染
│   │   └── validation.ts         # 表单校验
│   │
│   └── constants/
│       ├── roastTemplates.ts     # 吐槽模板库
│       ├── praiseTexts.ts        # 夸夸文案库
│       ├── weeklyComments.ts     # 周评语库
│       └── aiPrompts.ts          # AI prompt 模板
```

---

## 3. 数据模型

### 3.1 Project（项目表）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | string (UUID) | 主键 | 自动生成 |
| `name` | string | 项目名称 | NOT NULL |
| `description` | string | 项目描述 | 可空 |
| `target_date` | string (ISO) | 目标完成日期 | NOT NULL |
| `priority` | string | 优先级: high/medium/low | 默认 medium |
| `color` | string | 项目颜色标识 (HEX) | 默认 `#7C3AED` |
| `is_active` | boolean | 是否启用 | 默认 true |
| `created_at` | number (timestamp) | 创建时间 | 自动生成 |
| `updated_at` | number (timestamp) | 更新时间 | 自动更新 |

**索引**：`is_active`（过滤活跃项目）、`created_at`（排序）

### 3.2 Milestone（里程碑表）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | string (UUID) | 主键 | 自动生成 |
| `project_id` | string (FK) | 所属项目 | NOT NULL |
| `name` | string | 里程碑名称 | NOT NULL |
| `description` | string | 描述 | 可空 |
| `target_date` | string (ISO) | 目标日期 | NOT NULL |
| `sort_order` | number | 排序顺序 | 默认 0 |
| `created_at` | number (timestamp) | 创建时间 | 自动生成 |
| `updated_at` | number (timestamp) | 更新时间 | 自动更新 |

**索引**：`project_id` + `sort_order`（查询项目下里程碑排序）、`project_id` + `target_date`

**关联**：`project_id → Project.id`，级联删除

### 3.3 Subtask（子任务表）

子任务分为两种类型：

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | string (UUID) | 主键 | 自动生成 |
| `project_id` | string (FK) | 所属项目 | NOT NULL |
| `milestone_id` | string (FK) | 归属里程碑 | **可空** — 循环子任务不归属里程碑 |
| `name` | string | 子任务名称 | NOT NULL |
| `start_time` | string | 开始时间 (HH:mm) | NOT NULL |
| `end_time` | string | 结束时间 (HH:mm) | NOT NULL |
| `type` | string | 子任务类型 | `circular`（循环）/ `normal`（非循环） |
| `repeat_rule` | string | 重复规则 | 仅 `circular` 类型有效 |
| `priority` | string | 优先级: high/medium/low | 默认 medium |
| `auto_rollover` | boolean | 自动延期开关 | 仅 `normal` 类型有效，默认 true |
| `is_active` | boolean | 是否启用 | 默认 true |
| `created_at` | number (timestamp) | 创建时间 | 自动生成 |
| `updated_at` | number (timestamp) | 更新时间 | 自动更新 |

**两种子任务对比**：

| 特征 | circular（循环子任务） | normal（非循环子任务） |
|------|----------------------|----------------------|
| 示例 | "周一~周五 09:30 项目日会" | "周一 10:00 产品设计方案50%" |
| 归属里程碑 | 不归属（milestone_id = null） | 归属某个里程碑 |
| 性质 | 贯穿项目的长线日程 | 里程碑下的阶段性工作 |
| 实例生成 | 一次性生成本周/未来可见周期的所有实例 | 对应日期生成单个实例 |
| 操作按钮 | [打卡] [放弃] | [打卡] [放弃] [延期] |
| 未完成自动处理 | 标记 skipped，触发吐槽 | 生成新实例（rollover+1），触发吐槽 |
| 放弃操作 | 标记 skipped，触发吐槽，计入周报 | 标记 skipped，触发吐槽，计入周报 |

**`repeat_rule` 枚举值**（仅 circular 类型）：
- `"daily"` — 每天
- `"weekdays"` — 周一到周五
- `"custom:1,2,3,4,5"` — 自定义周几（1=周一，7=周日）

**索引**：`project_id` + `is_active`、`milestone_id`、`type`

**关联**：`project_id → Project.id`，`milestone_id → Milestone.id`（set null on delete）

### 3.4 TaskInstance（任务实例表）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | string (UUID) | 主键 | 自动生成 |
| `subtask_id` | string (FK) | 来源子任务 | NOT NULL |
| `project_id` | string (FK) | 所属项目（冗余，便于查询） | NOT NULL |
| `date` | string (YYYY-MM-DD) | 归属日期 | NOT NULL |
| `start_time` | string | 开始时间 (HH:mm) | NOT NULL |
| `end_time` | string | 结束时间 (HH:mm) | NOT NULL |
| `status` | string | 状态 | NOT NULL |
| `is_rollover` | boolean | 是否为延期实例 | 默认 false |
| `rollover_count` | number | 延期次数 | 默认 0 |
| `is_makeup` | boolean | 是否为补卡 | 默认 false |
| `completed_at` | number (timestamp) | 完成时间 | 可空 |
| `started_at` | number (timestamp) | 实际开始时间 | 可空 |
| `note` | string | 打卡备注 | 可空 |
| `created_at` | number (timestamp) | 创建时间 | 自动生成 |
| `updated_at` | number (timestamp) | 更新时间 | 自动更新 |

**`status` 枚举值**：
- `"pending"` — 待开始
- `"in_progress"` — 进行中
- `"completed"` — 已完成
- `"skipped"` — 已放弃
- `"overdue"` — 已过期（延期）

**索引**：`date` + `status`（查询今日任务）、`project_id` + `date`、`subtask_id` + `date`、`status` + `is_rollover`

**关联**：`subtask_id → Subtask.id`，`project_id → Project.id`

### 3.5 WeeklyReport（周报表）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | string (UUID) | 主键 | 自动生成 |
| `week_start` | string (YYYY-MM-DD) | 周一日期 | NOT NULL, UNIQUE |
| `week_end` | string (YYYY-MM-DD) | 周日日期 | NOT NULL |
| `completion_rate` | number | 完成率 (0-100) | NOT NULL |
| `completed_count` | number | 完成数 | NOT NULL |
| `total_count` | number | 总任务数 | NOT NULL |
| `overdue_count` | number | 延期次数 | NOT NULL |
| `streak_days` | number | 连续打卡天数 | NOT NULL |
| `roast_count` | number | 被骂次数 | NOT NULL |
| `rating` | string | 评级 (SSS/SS/S/A/B/C/D) | NOT NULL |
| `comment` | string | 周评语 | NOT NULL |
| `project_stats` | string (JSON) | 各项目完成率统计 | NOT NULL |
| `red_black_list` | string (JSON) | 红黑榜数据 | NOT NULL |
| `generated_at` | number (timestamp) | 生成时间 | 自动生成 |

### 3.6 ER 关系图

```
Project (1) ────< Milestone (1) ────< Subtask[type=normal] (1) ────< TaskInstance (N)
   │
   └───< Subtask[type=circular] (1) ────< TaskInstance (N)
                                          (提前生成本周所有实例)

Subtask ────< TaskInstance
   │
   └─── 状态机:
        normal:  pending → in_progress → completed/skipped/overdue
        circular: pending → in_progress → completed/skipped（无 overdue）
```

**循环子任务实例生成策略**：
- 创建时一次性生成本周（周一到周日）对应日期的所有实例
- 每周一自动补充下周的实例（App 启动时触发）
- 用户今天可以看到未来一周内所有已生成的循环任务实例

---

## 4. 核心模块技术方案

### 4.1 自动延期引擎 (`src/services/rolloverEngine.ts`)

#### 触发时机
1. **App 启动时补偿扫描**（主要方案）：每次 App 冷启动时执行
2. **Background App Refresh**（辅助方案）：iOS 系统定期触发（约 1-2 次/天）
3. **午夜本地通知触发**：注册一个静默通知，App 收到后执行（可选，iOS 14+ 限制）

#### 核心逻辑

```typescript
async function executeRollover(): Promise<void> {
  const yesterday = getYesterday();
  const today = getToday();

  // 查找昨天未完成的实例 (pending / in_progress / overdue)
  const pendingInstances = await database
    .get('task_instances')
    .query(Q.where('date', yesterday), Q.where('status', Q.oneOf(['pending', 'in_progress', 'overdue'])));

  for (const instance of pendingInstances) {
    const subtask = await instance.subtask.fetch();

    if (subtask.type === 'circular') {
      // 循环子任务：自动标记为 skipped，触发吐槽，不生成新实例（实例已提前生成）
      await instance.update(record => { record.status = 'skipped'; });
      await triggerRoastForInstance(instance);
    } else if (subtask.auto_rollover && instance.rollover_count < 7) {
      // 非循环 + 开启自动延期 + 未达上限：生成今日新实例
      await createTaskInstance({
        subtask_id: subtask.id,
        project_id: subtask.project_id,
        date: today,
        start_time: subtask.start_time,
        end_time: subtask.end_time,
        status: 'overdue',
        is_rollover: true,
        rollover_count: instance.rollover_count + 1,
      });
      await instance.update(record => { record.status = 'overdue'; });
      await triggerRoastForInstance(instance);
    } else if (instance.rollover_count >= 7) {
      // 达到延期上限
      await instance.update(record => { record.status = 'expired'; });
      await triggerMaxRolloverRoast(instance);
    }
  }

  // 生成今天所有新实例的任务提醒通知
  await scheduleTodayNotifications();
}
```
```

#### 循环子任务实例生成

```typescript
// 创建循环子任务时，一次性生成本周对应日期的实例
async function generateCircularInstances(subtask: Subtask): Promise<void> {
  const weekStart = getWeekStart(); // 本周一
  const weekEnd = getWeekEnd();     // 本周日

  for (let d = weekStart; d <= weekEnd; d = addDays(d, 1)) {
    if (shouldGenerateOnDay(subtask, d)) {
      await createTaskInstance({
        subtask_id: subtask.id,
        project_id: subtask.project_id,
        date: d,
        start_time: subtask.start_time,
        end_time: subtask.end_time,
        status: 'pending',
        is_rollover: false,
        rollover_count: 0,
      });
    }
  }
}

// 每周一 App 启动时，补充生成下周的循环任务实例
async function generateNextWeekCircularInstances(): Promise<void> {
  const circularSubtasks = await database
    .get('subtasks')
    .query(Q.where('type', 'circular'), Q.where('is_active', true));

  for (const subtask of circularSubtasks) {
    await generateCircularInstances(subtask); // 传入下周日期范围
  }
}
```

#### 非循环子任务判断逻辑

```typescript
function isCircularSubtask(subtask: Subtask): boolean {
  return subtask.type === 'circular';
}

function shouldGenerateOnDay(subtask: Subtask, day: Date): boolean {
  const dayOfWeek = day.getDay(); // 0=周日, 1=周一...
  const rule = subtask.repeat_rule;

  if (rule === 'daily') return true;
  if (rule === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (rule.startsWith('custom:')) {
    const days = rule.split(':')[1].split(',').map(Number);
    return days.includes(dayOfWeek === 0 ? 7 : dayOfWeek);
  }
  return false;
}
```
```

#### App 启动补偿

```typescript
// app/_layout.tsx
useEffect(() => {
  async function init() {
    await database.ensureInitialized();
    // 检查是否需要执行延期
    const lastRolloverDate = await getLastRolloverDate();
    const today = getTodayDateString();

    if (lastRolloverDate !== today) {
      await executeRollover();
      await setLastRolloverDate(today);
    }

    // 调度今日任务状态自动开始
    await scheduleTaskStatusChecks();
  }
  init();
}, []);
```

### 4.2 吐槽引擎 (`src/services/roastEngine.ts`)

#### 模板结构

```typescript
interface RoastTemplate {
  id: string;
  level: 1 | 2 | 3;       // L1/L2/L3
  text: string;            // 模板文案，支持 {name}, {count}, {time}, {project}, {rate}, {type} 占位符
  minRollover: number;     // 最小延期次数
  maxRollover: number;     // 最大延期次数
  cooldownHours: number;   // 冷却时间（同文案 N 小时内不重复）
}
```

#### 分级逻辑

```typescript
function getRoastLevel(rolloverCount: number, fireMode: boolean): number {
  const offset = fireMode ? 1 : 0;  // 火力全开模式起始级别 +1
  if (rolloverCount + offset <= 2) return 1;
  if (rolloverCount + offset <= 5) return 2;
  return 3;
}
```

#### 文案生成

```typescript
async function generateRoastText(instance: TaskInstance): Promise<string> {
  const subtask = await instance.subtask.fetch();
  const project = await subtask.project.fetch();
  const level = getRoastLevel(instance.rollover_count, getFireMode());

  // 从模板库筛选
  const candidates = roastTemplates.filter(t =>
    t.level === level &&
    instance.rollover_count >= t.minRollover &&
    instance.rollover_count <= t.maxRollover
  );

  // 去重：排除最近使用过的文案
  const usedTexts = await getRecentRoastTexts(instance.subtask_id, 72); // 72 小时
  const available = candidates.filter(t => !usedTexts.includes(t.text));

  const template = available[Math.floor(Math.random() * available.length)] || candidates[0];

  // 渲染模板
  const rate = await getSubtaskCompletionRate(subtask.id);
  const taskType = inferTaskType(subtask.name);

  return renderTemplate(template.text, {
    name: subtask.name,
    count: instance.rollover_count,
    time: `${subtask.start_time}-${subtask.end_time}`,
    project: project.name,
    rate: Math.round(rate),
    type: taskType.label,
  });
}
```

#### 每日吐槽卡片 (`src/services/dailyRoast.ts`)

首页日期下方的吐槽卡片，每次打开 App 或刷新时刷新。

```typescript
interface DailyRoastContext {
  totalTasks: number;      // 今日任务总数
  completedTasks: number;  // 已完成数
  pendingTasks: number;    // 待开始数
  overdueTasks: number;    // 延期数
  skippedTasks: number;    // 放弃数
  recentAction: string | null; // 最近一次用户行为: 'completed' | 'skipped' | 'deferred' | null
}

type RoastMood = 'roast' | 'tease' | 'praise';

function determineMood(ctx: DailyRoastContext): RoastMood {
  if (ctx.totalTasks === 0) return 'roast'; // 无任务也算嘲讽
  const rate = ctx.completedTasks / ctx.totalTasks;
  if (rate >= 1) return 'praise';
  if (rate >= 0.5) return 'tease';
  return 'roast';
}

async function generateDailyRoast(ctx: DailyRoastContext): Promise<string> {
  const mood = determineMood(ctx);

  // 从对应情绪模板中选择
  const candidates = dailyRoastTemplates.filter(t => t.mood === mood);
  const usedTexts = await getRecentDailyRoastTexts(72); // 72 小时去重
  const available = candidates.filter(t => !usedTexts.includes(t.text));
  const template = available[Math.floor(Math.random() * available.length)] || candidates[0];

  return renderTemplate(template.text, {
    total: ctx.totalTasks,
    completed: ctx.completedTasks,
    pending: ctx.pendingTasks,
    overdue: ctx.overdueTasks,
    action: ctx.recentAction || '',
  });
}
```

每日吐槽模板示例：

```typescript
export const dailyRoastTemplates: DailyRoastTemplate[] = [
  // 毒舌型（完成率 < 50%）
  { id: 'dr-1', mood: 'roast', text: '今天 {total} 个任务，{completed} 个完成了，剩下 {pending} 个你打算怎么办？', cooldownHours: 72 },
  { id: 'dr-2', mood: 'roast', text: '{overdue} 个延期任务在看着你，你确定今天还能躺平？', cooldownHours: 72 },
  { id: 'dr-3', mood: 'roast', text: '连任务都没有，今天打算躺平？', cooldownHours: 72 },

  // 调侃型（50% <= 完成率 < 100%）
  { id: 'dr-4', mood: 'tease', text: '{completed}/{total} 了，还行吧，但别以为这样就能混过去', cooldownHours: 72 },
  { id: 'dr-5', mood: 'tease', text: '已完成一半了，离被骂还差几步，加油', cooldownHours: 72 },

  // 夸奖型（完成率 = 100%）
  { id: 'dr-6', mood: 'praise', text: '今天全清！你是时间的统治者', cooldownHours: 72 },
  { id: 'dr-7', mood: 'praise', text: '完美收官，明天的你也会感谢今天的自己', cooldownHours: 72 },
];
```

#### 吐槽模板库 (`src/constants/roastTemplates.ts`)

每种级别预置 15-25 条模板，示例：

```typescript
export const roastTemplates: RoastTemplate[] = [
  // L1 阴阳怪气
  { id: 'l1-1', level: 1, text: '「{name}」又延期了？没事，计划不就是用来打破的', minRollover: 1, maxRollover: 2, cooldownHours: 72 },
  { id: 'l1-2', level: 1, text: '「{name}」延期{count}次了，{time}的任务硬生生拖成了连续剧', minRollover: 1, maxRollover: 2, cooldownHours: 72 },
  { id: 'l1-3', level: 1, text: '说好的{time}开始呢，现在都第二天了', minRollover: 1, maxRollover: 2, cooldownHours: 72 },

  // L2 直接开喷
  { id: 'l2-1', level: 2, text: '「{name}」延期{count}次了，你是不是根本没打算做？', minRollover: 3, maxRollover: 5, cooldownHours: 72 },
  { id: 'l2-2', level: 2, text: '「{project}」的「{name}」都延了{count}次了，项目进度被你自己拖慢了', minRollover: 3, maxRollover: 5, cooldownHours: 72 },
  { id: 'l2-3', level: 2, text: '「{name}」{rate}%的完成率，说实话这个任务对你来说是不是超纲了', minRollover: 3, maxRollover: 5, cooldownHours: 72 },

  // L3 终极清算
  { id: 'l3-1', level: 3, text: '「{name}」延期{count}次，建议你直接把任务删了，别折磨自己了', minRollover: 6, maxRollover: 7, cooldownHours: 48 },
  { id: 'l3-2', level: 3, text: '你的人生有几个{count}天可以浪费在「{name}」上', minRollover: 6, maxRollover: 7, cooldownHours: 48 },
];
```

### 4.3 打卡系统 / 任务状态机 (`src/services/taskScheduler.ts`)

#### 状态流转（非循环子任务）

```
pending ──(时间到达)──→ in_progress ──(用户打卡)──→ completed
   │                        │
   │                        ├──(用户放弃)──→ skipped  → 触发吐槽
   │                        │
   │                        ├──(用户延期)──→ 生成新实例，rollover_count+1 → 触发吐槽
   │                        │
   │                        └──(超时)──→ overdue  → 触发吐槽
   │
   ├──(用户放弃)──→ skipped  → 触发吐槽
   │
   └──(用户延期)──→ 生成新实例 → 触发吐槽

overdue ──(用户补卡)──→ completed (is_makeup = true)
overdue ──(用户放弃)──→ skipped  → 触发吐槽
```

#### 状态流转（循环子任务）

```
pending ──(时间到达)──→ in_progress ──(用户打卡)──→ completed
   │                        │
   │                        ├──(用户放弃)──→ skipped  → 触发吐槽
   │                        │
   │                        └──(超时)──→ skipped  → 触发吐槽
   │
   └──(用户放弃)──→ skipped  → 触发吐槽
```

- 循环子任务**无 overdue 状态**，超时后自动标记 skipped
- 循环子任务**无延期按钮**，只有 [打卡] 和 [放弃]

#### 自动开始逻辑

```typescript
// 定时检查（App 运行时每分钟执行一次）
async function checkAutoStart(): Promise<void> {
  const now = getCurrentTime();
  const today = getTodayDateString();

  const pendingTasks = await database
    .get('task_instances')
    .query(
      Q.where('date', today),
      Q.where('status', 'pending'),
      Q.where('start_time', Q.lte(now))
    );

  for (const task of pendingTasks) {
    await task.update(record => {
      record.status = 'in_progress';
      record.started_at = Date.now();
    });
  }
}

// App 启动时注册定时器
// 使用 setInterval(checkAutoStart, 60000) 或更优方案
```

#### 超时自动标记 overdue

```typescript
async function checkAutoOverdue(): Promise<void> {
  const now = getCurrentTime();
  const today = getTodayDateString();

  const inProgressTasks = await database
    .get('task_instances')
    .query(
      Q.where('date', today),
      Q.where('status', 'in_progress'),
      Q.where('end_time', Q.lte(now))
    );

  for (const task of inProgressTasks) {
    await task.update(record => { record.status = 'overdue'; });
    // 触发超时吐槽
    await triggerTimeoutRoast(task);
  }
}
```

### 4.4 通知系统 (`src/services/notificationService.ts`)

#### iOS 64 条本地通知限制处理

策略：仅注册**当日和次日**的通知，动态注册/取消。

```typescript
async function scheduleTodayNotifications(): Promise<void> {
  // 1. 取消所有 pending 的本地通知
  await Notifications.dismissAllNotificationsAsync();

  // 2. 获取今天和明天的任务实例
  const today = getTodayDateString();
  const tomorrow = getTomorrowDateString();
  const instances = await database
    .get('task_instances')
    .query(Q.where('date', Q.oneOf([today, tomorrow])), Q.where('status', Q.oneOf(['pending', 'in_progress'])));

  // 3. 为每个任务注册提醒（开始前 5 分钟）
  for (const instance of instances) {
    const subtask = await instance.subtask.fetch();
    const triggerTime = calculateTriggerTime(instance.date, instance.start_time, -5); // 提前5分钟

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${subtask.name} 要开始了`,
        body: `别装没看见`,
        data: { taskId: instance.id },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
  }
}
```

#### 通知类型

| 类型 | 触发方式 | 实现 |
|------|---------|------|
| 任务提醒 | 任务开始前 5 分钟 | 本地通知（动态注册） |
| 超时吐槽 | 任务结束时间到达 | 本地通知（延期引擎中触发） |
| 延期通知 | 每日 08:00 | 本地通知（每日重复） |
| 完成庆祝 | 当日全部完成 | App 内逻辑 + 本地通知 |
| 周结算 | 每周日 21:00 | 本地通知（每周重复） |

### 4.5 周结算系统 (`src/services/weeklyReport.ts`)

#### 触发方式

1. 每周日 21:00 注册一个本地通知，用户点击后打开 App
2. App 启动时检查是否有未生成的周报，如有则自动生成并弹出

#### 评级计算

```typescript
function calculateRating(completionRate: number): string {
  if (completionRate === 100) return 'SSS';
  if (completionRate >= 95) return 'SS';
  if (completionRate >= 90) return 'S';
  if (completionRate >= 80) return 'A';
  if (completionRate >= 70) return 'B';
  if (completionRate >= 60) return 'C';
  return 'D';
}
```

#### 周报生成

```typescript
async function generateWeeklyReport(weekStart: string, weekEnd: string): Promise<WeeklyReport> {
  // 1. 统计该周所有任务实例
  const instances = await database
    .get('task_instances')
    .query(Q.where('date', Q.gte(weekStart)), Q.where('date', Q.lte(weekEnd)));

  // 2. 计算完成率（不含 skipped）
  const totalInstances = instances.filter(i => i.status !== 'skipped');
  const completedInstances = totalInstances.filter(i => i.status === 'completed');
  const completionRate = totalInstances.length > 0
    ? Math.round((completedInstances.length / totalInstances.length) * 100)
    : 0;

  // 3. 计算评级
  const rating = calculateRating(completionRate);

  // 4. 按项目维度统计
  const projectStats = await calculateProjectStats(instances);

  // 5. 红黑榜（子任务完成率排名）
  const redBlackList = await calculateRedBlackList(instances);

  // 6. 生成周评语
  const comment = generateWeeklyComment(completionRate, rating, projectStats, redBlackList);

  // 7. 保存到数据库
  const report = await database.write(async () => {
    return database.get('weekly_reports').create(record => {
      record.week_start = weekStart;
      record.week_end = weekEnd;
      record.completion_rate = completionRate;
      record.completed_count = completedInstances.length;
      record.total_count = totalInstances.length;
      record.rating = rating;
      record.comment = comment;
      record.project_stats = JSON.stringify(projectStats);
      record.red_black_list = JSON.stringify(redBlackList);
    });
  });

  return report;
}
```

### 4.6 AI 项目拆解 (`src/api/claude.ts`)

#### Prompt 设计

```typescript
const SYSTEM_PROMPT = `你是一个专业的 IT 项目经理和 PMO 助手。
你的任务是将用户的项目描述拆解为里程碑和子任务。

规则：
1. 里程碑应该是项目的阶段性目标，通常 2-5 个
2. 每个里程碑下的子任务应该是每日可执行的工作单元
3. 子任务应该设定合理的时间段（通常 1-3 小时）
4. 不要生成循环子任务，所有子任务均为一次性（once）的普通子任务
5. 对于需要多天连续完成的工作，按天拆分为带进度的独立子任务（如"周一 首页开发20%"、"周二 首页开发40%"）
6. 考虑用户的每日可用时间段，不要安排得太满
7. 工作日和周末的节奏应该有差异
8. 输出必须是严格的 JSON 格式，不要输出其他内容`;

const RESPONSE_SCHEMA = {
  milestones: [
    {
      name: "string",
      targetDate: "YYYY-MM-DD",
      description: "string",
      subtasks: [
        {
          name: "string",
          startTime: "HH:mm",
          endTime: "HH:mm",
          repeatRule: "once",
          priority: "high | medium | low",
        }
      ]
    }
  ]
};
```

#### API 调用

```typescript
async function decomposeProject(description: string, weeks: number, availableHours: { start: string; end: string }): Promise<AIDecomposeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s 超时

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20260316',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `项目描述：${description}\n计划周期：${weeks}周\n每日可用时间：${availableHours.start}-${availableHours.end}\n请以 JSON 格式返回拆解结果`,
      }],
    }, { signal: controller.signal });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const json = extractJSON(text); // 从 AI 响应中提取 JSON
    return validateDecomposeResult(json);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI 响应超时');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 4.7 Markdown 解析器 (`src/services/markdownParser.ts`)

#### 解析规则

```typescript
interface ParsedMilestone {
  name: string;
  weekRange: string;     // "第1周" / "第2-3周"
  subtasks: ParsedSubtask[];
}

interface ParsedSubtask {
  name: string;
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
  repeatRule: string;    // "daily" / "weekdays" / "custom:..." / "once"
  isCircular: boolean;
}
```

#### 核心解析逻辑

```typescript
function parseMarkdown(content: string): ParseResult {
  const lines = content.split('\n');
  const milestones: ParsedMilestone[] = [];
  const warnings: string[] = [];
  let currentMilestone: ParsedMilestone | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 匹配里程碑: ## 里程碑X：名称（第N周）或 ## 名称（第N周）
    const milestoneMatch = line.match(/^##\s+(?:里程碑\d*[：:]\s*)?(.+?)\s*[（(]第([\d-]+)周[）)]/);
    if (milestoneMatch) {
      currentMilestone = {
        name: milestoneMatch[1].replace(/里程碑\d*[：:]\s*/, '').trim(),
        weekRange: milestoneMatch[2],
        subtasks: [],
      };
      milestones.push(currentMilestone);
      continue;
    }

    // 匹配子任务: - 周X[~周Y] HH:MM-HH:MM 任务名称
    // Markdown 导入不生成循环子任务，"周X~周Y" 范围会被展开为多个独立的一次性子任务
    const subtaskMatch = line.match(/^[-*]\s+(周一|周二|周三|周四|周五|周六|周日)(?:~(周一|周二|周三|周四|周五|周六|周日))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s+(.+)/);
    if (subtaskMatch && currentMilestone) {
      const startDay = subtaskMatch[1];
      const endDay = subtaskMatch[2];
      const baseName = subtaskMatch[5].replace(/（循环）/g, '').trim();

      if (endDay) {
        // "周X~周Y" 范围：展开为多个独立的一次性子任务
        const days = expandDayRange(startDay, endDay);
        for (const day of days) {
          currentMilestone.subtasks.push({
            name: baseName,
            startTime: subtaskMatch[3],
            endTime: subtaskMatch[4],
            repeatRule: 'once', // 导入不生成循环，全部为一次性
            isCircular: false,
          });
        }
      } else {
        // 单个周X：一次性子任务
        currentMilestone.subtasks.push({
          name: baseName,
          startTime: subtaskMatch[3],
          endTime: subtaskMatch[4],
          repeatRule: 'once',
          isCircular: false,
        });
      }
      continue;
    }

    // 未匹配的行
    if (line && !line.startsWith('#') && currentMilestone) {
      warnings.push(`第${i + 1}行：「${line}」格式不明确`);
    }
  }

  return { milestones, warnings };
}
```

---

## 5. 状态管理方案

### 5.1 架构选择

采用 **WatermelonDB Observable** 作为唯一数据源，无需 Redux/MobX。

```
WatermelonDB (SQLite)
    │
    ├── Observable<Project[]> ──→ React Component (useObservable)
    ├── Observable<Milestone[]> ──→ React Component
    ├── Observable<TaskInstance[]> ──→ React Component
    └── ...
```

### 5.2 WatermelonDB Hooks

```typescript
// src/db/hooks.ts
export function useProjects(): Project[] {
  const projects = useObservable(
    () => database.collections.get('projects')
      .query(Q.where('is_active', true), Q.sortBy('created_at', 'asc'))
      .observe(),
    []
  );
  return projects;
}

export function useTodayInstances(): TaskInstance[] {
  const today = getTodayDateString();
  const instances = useObservable(
    () => database.collections.get('task_instances')
      .query(
        Q.where('date', today),
        Q.sortBy('start_time', 'asc')
      )
      .observe(),
    [today]
  );
  return instances;
}
```

### 5.3 非数据库状态

少量 UI 状态使用 React Context：

- **ThemeContext**：深色/亮色模式
- **SettingsContext**：吐槽烈度、通知偏好
- **AIContext**：AI 拆解的临时结果（未确认创建前）

---

## 6. 关键技术难点与解决方案

### 6.1 iOS 后台任务限制

**问题**：iOS 不保证后台任务执行时间，自动延期可能无法在 00:00 精确触发。

**解决方案**：
1. **主要**：App 每次冷启动/热启动时执行补偿扫描，检查并处理未完成的延期
2. **辅助**：注册 Background App Refresh，iOS 系统会定期（约 1-2 次/天）唤醒 App
3. **用户体验**：即使 App 几天不打开，下次打开时所有延期任务会一次性处理完毕

### 6.2 本地通知 64 条限制

**问题**：iOS 最多允许 64 个 pending local notifications。

**解决方案**：
- 只在 App 启动时注册**当日和次日**的任务提醒通知
- 每次数据变化（创建/删除/修改任务）时动态更新通知队列
- 每日 08:00 延期通知和周日 21:00 周报通知使用重复通知（不占太多额度）

### 6.3 AI 响应超时与失败

**问题**：AI API 调用可能超时、网络不稳定、返回格式异常。

**解决方案**：
- 30 秒超时限制，超时后提示用户手动创建
- AI 返回格式校验失败时，提示"AI 返回结果格式有误，请重试或手动创建"
- 骨架屏 + 加载文案（"别急，我在帮你规划"）缓解等待焦虑
- 离线时该功能不可用，但手动创建仍可用

### 6.4 Markdown 解析容错

**问题**：用户上传的文档格式可能不完全符合规范。

**解决方案**：
- 逐行解析，不匹配的行收集为 warnings 而非直接报错
- 解析结果预览中明确标注哪些行未识别，并给出修正建议
- 提供"手动调整"模式，用户可在确认后补充/修改
- 完全无法解析时（零里程碑），提示格式说明并提供示例

### 6.5 跨零点任务处理

**问题**：如 23:00-01:00 的任务归属哪个日期。

**解决方案**：
- 归属到**开始日期**（23:00 那天）
- 延期引擎扫描时，查找前一天的未完成实例时包含这类任务

### 6.6 任务实例生成的性能

**问题**：如果用户有 10 个项目 × 50 个子任务，每日生成 50 个实例是否影响性能。

**解决方案**：
- 延期引擎在 App 启动时执行，WatermelonDB 批量写入性能优秀（50 条 < 100ms）
- 使用 WatermelonDB 的 `database.batch()` 批量操作
- TaskInstance 表使用 `date` 索引，查询今日任务 O(log n)

### 6.7 吐槽去重机制

**问题**：如何确保同一吐槽文案 3 天内不重复。

**解决方案**：
- 在 TaskInstance 表或单独的 RoastHistory 表中记录每次吐槽的文案
- 生成新吐槽时，查询最近 72 小时内该子任务已使用的文案，从候选中排除

```typescript
// RoastHistory 表（可选，如果不想在主表中添加字段）
interface RoastHistory {
  id: string;
  subtask_id: string;
  text_hash: string;    // 文案的 hash 值
  created_at: number;   // 时间戳
}
```

---

## 7. 错误处理与边界情况

### 7.1 全局错误处理

```typescript
// app/_layout.tsx
import * as ErrorReporting from './src/utils/errorReporting';

// 捕获未处理的 Promise rejection
PromiseRejectionTrackingOptions.addEventListener('unhandledRejection', (event) => {
  ErrorReporting.capture(event.reason);
});
```

### 7.2 关键操作的错误处理

| 操作 | 错误场景 | 处理方式 |
|------|---------|---------|
| AI 拆解 | 网络不可用 | 提示"AI 暂时离线，你可以手动创建" |
| AI 拆解 | 响应超时 | 30s 超时，提示"AI 思考太慢了" |
| AI 拆解 | 返回格式异常 | 提示"AI 返回结果有误，请重试" |
| Markdown 导入 | 文件格式错误 | 提示"请选择 .md 文件" |
| Markdown 导入 | 解析零结果 | 提示"格式不匹配，请参考示例" |
| 数据库写入 | 磁盘空间不足 | 提示"存储空间不足" |
| 通知注册 | 用户未授权 | 引导用户开启通知权限 |
| 延期引擎 | 并发写入冲突 | WatermelonDB 自动处理（乐观锁） |

---

## 8. 安全考虑

### 8.1 API Key 管理

- Claude API Key 存储在 App 的 Keychain 中（使用 `expo-secure-store`）
- 首次使用时通过设置页面输入
- 不在代码中硬编码

### 8.2 数据安全

- V1 所有数据存储在本地 SQLite，不上传服务器
- 不涉及用户隐私数据收集
- 数据导出功能（JSON/CSV）仅导出用户自己的数据
