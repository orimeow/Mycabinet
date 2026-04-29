# Scram（滚蛋计划）- 开发节奏文档

## 1. 总体排期概览

| 阶段 | 时间 | 定位 | 关键产出 |
|------|------|------|----------|
| **Week 1-2** | 基础框架 + AI 能力 | 搭建架构、完成项目→子任务→打卡链路 | 可创建项目、AI 拆解、导入 Markdown、打卡 |
| **Week 3** | 核心引擎 | 延期引擎、吐槽系统、推送通知 | 完整的延期→吐槽→通知闭环 |
| **Week 4** | 结算与收尾 | 周结算、统计、日历、打磨 | 可提交 TestFlight 的完整 MVP |

---

## 2. Week 1-2：基础框架 + AI 能力

### 2.1 Week 1：项目初始化 + 数据库 + 项目 CRUD

#### Day 1：项目初始化
- [ ] 初始化 Expo 项目（SDK 52+）
- [ ] 配置 TypeScript、ESLint、Prettier
- [ ] 安装核心依赖（WatermelonDB、Expo Router、reanimated）
- [ ] 搭建目录结构（参考 TECH_SPEC.md 第 2 节）
- [ ] 导入 Design Token（`src/theme/`，从 DESIGN.md 第 7 节复制）
- [ ] 配置底部 Tab Bar（Today / Weekly / Calendar / Projects）

#### Day 2：数据库搭建
- [ ] 定义 WatermelonDB Schema（4 张表 + WeeklyReport）
- [ ] 数据库初始化逻辑（`src/db/index.ts`）
- [ ] 编写基础 hooks（useProjects、useTodayInstances 等）
- [ ] 数据库测试：增删改查 Project 表

#### Day 3-4：项目 CRUD
- [ ] 项目列表页（`app/(tabs)/projects.tsx`）
  - 卡片式展示 + 进度条
  - 左滑删除
  - 右上角"+"创建按钮
- [ ] 创建项目页（`app/project/new.tsx`）
  - 表单：名称、描述、目标日期、优先级、颜色选择器
  - 表单校验
- [ ] 编辑项目页（`app/project/[id]/edit.tsx`）
- [ ] 启用/停用项目开关

#### Day 5：里程碑 CRUD
- [ ] 项目详情页（`app/project/[id].tsx`）
  - 里程碑分组展示 + 进度
  - 里程碑内子任务列表
- [ ] 创建里程碑弹窗/页面
- [ ] 编辑/删除里程碑
- [ ] 删除里程碑时子任务移到"未分类"

#### Day 5 里程碑检查
> **Week 1 Checkpoint**：可创建项目、添加里程碑、数据库正确存储。

### 2.2 Week 2：子任务 + AI 能力 + 打卡

#### Day 1-2：子任务 CRUD
- [ ] 创建子任务表单（`app/subtask/new.tsx`）
  - 名称、时间段（UIDatePicker 风格）
  - 重复规则选择（每天/工作日/自定义/一次性）
  - 优先级、归属里程碑选择
  - 自动延期开关
- [ ] 编辑子任务页（`app/subtask/[id]/edit.tsx`）
- [ ] 子任务列表展示（在项目详情页中）
- [ ] 左滑删除子任务
- [ ] 循环子任务标记

#### Day 3：AI 项目拆解
- [ ] AI 拆解引导页（`app/ai-decompose.tsx`）
  - 项目描述输入框 + 计划周期选择 + 可用时间段
- [ ] Claude API 集成（`src/api/claude.ts`）
  - System Prompt 设计
  - JSON 解析与校验
  - 超时处理（30s）
- [ ] 拆解结果预览页
  - 里程碑时间线 + 子任务列表
  - 可编辑/删除/新增
- [ ] 确认创建 → 批量写入数据库
- [ ] 错误处理：离线、超时、格式异常

#### Day 4：Markdown 导入
- [ ] 导入方式选择页（`app/import-markdown.tsx`）
  - 文件选择、粘贴文本
- [ ] Markdown 解析器（`src/services/markdownParser.ts`）
- [ ] 解析结果预览
- [ ] 手动调整模式
- [ ] 容错处理：格式不明确行标注 + 修正建议
- [ ] 确认创建 → 批量写入数据库

#### Day 5：今日日程视图 + 任务卡片
- [ ] 首页（`app/(tabs)/index.tsx`）
  - 顶部日期 + 打卡天数 + 被骂次数
  - 任务卡片列表（跨项目混排，按时间排序）
  - 底部本周完成率进度条
- [ ] TaskCard 组件（`src/components/TaskCard.tsx`）
  - pending 状态：灰色 + 倒计时
  - in_progress 状态：蓝色高亮
  - completed 状态：绿色半透明
  - overdue 状态：红色渐变 + 吐槽气泡
  - 排序逻辑（时间 > 优先级 > 创建时间）
- [ ] 空状态插画 + 文案
- [ ] 下拉刷新

#### 周末集成测试
> **Week 2 Checkpoint**：完整的项目 → 里程碑 → 子任务 → AI 拆解 → Markdown 导入 → 今日日程展示链路可运行。

---

## 3. Week 3：核心引擎

### 3.1 周一-周二：打卡系统 + 任务调度

#### 打卡操作
- [ ] 自动开始逻辑（`src/services/taskScheduler.ts`）
  - 定时检查（每分钟），pending → in_progress
  - App 启动时立即执行一次
- [ ] 打卡完成按钮
  - 弹出备注输入框（可选）
  - 状态变为 completed
- [ ] 放弃按钮 → skipped
- [ ] 补卡按钮（针对 overdue 任务）

#### 延期操作
- [ ] 延期时间调整弹窗（`src/components/DeferralModal.tsx`）
  - 今日/明日/自定义日期选择
  - 时间段修改
  - 可控调整 vs 延期判断逻辑
- [ ] 循环子任务不显示延期按钮

### 3.2 周三-周四：自动延期引擎

- [ ] 延期引擎（`src/services/rolloverEngine.ts`）
  - App 启动时补偿扫描
  - 循环子任务延期逻辑
  - 非循环子任务延期逻辑
  - 延期上限（7 次）处理
- [ ] Background App Refresh 注册（辅助触发）
- [ ] 最后执行日期记录（防止重复执行）
- [ ] 延期实例生成 + rollover_count 递增

### 3.3 周四-周五：吐槽系统

- [ ] 吐槽模板库（`src/constants/roastTemplates.ts`）
  - L1 阴阳怪气（15+ 条）
  - L2 直接开喷（15+ 条）
  - L3 终极清算（10+ 条）
- [ ] 吐槽引擎（`src/services/roastEngine.ts`）
  - 分级逻辑
  - 模板渲染（占位符替换）
  - 去重机制（72 小时）
- [ ] 吐槽气泡组件（`src/components/RoastBubble.tsx`）
  - 渐变背景 + 小三角 + emoji
  - 点击展开完整吐槽
- [ ] 延期确认弹窗（吐槽式按钮文案）
- [ ] 夸夸系统（`src/services/praiseEngine.ts`）
  - 按时完成、提前完成、延期完成、全部完成
- [ ] 吐槽设置页（`app/settings/roast.tsx`）
  - 正常模式 / 火力全开
  - 吐槽统计

### 3.4 周五：推送通知

- [ ] 通知权限请求 + 引导
- [ ] 任务提醒通知（开始前 5 分钟）
- [ ] 延期通知（每日 08:00）
- [ ] 完成庆祝通知
- [ ] 通知动态注册/取消（64 条限制处理）
- [ ] 静默时段设置（`app/settings/notification.tsx`）

#### 周末集成测试
> **Week 3 Checkpoint**：延期 → 吐槽 → 通知完整闭环可运行。

---

## 4. Week 4：结算与收尾

### 4.1 周一-周二：周结算系统

- [ ] 周报生成逻辑（`src/services/weeklyReport.ts`）
  - 完成率计算
  - 评级计算（SSS-D）
  - 项目维度统计
  - 红黑榜
  - 周评语生成
- [ ] WeeklyReport 表数据写入
- [ ] 周报弹窗展示（周日 21:00 触发）
- [ ] 周报首页（`app/(tabs)/weekly.tsx`）
  - 本周统计卡片
  - 红黑榜
  - 历史周报列表
- [ ] 历史周报详情（`app/weekly/[id].tsx`）
- [ ] 周报分享功能（生成图片 + 系统分享面板）

### 4.2 周三：基础统计

- [ ] 本周完成率（环形进度图）
- [ ] 连续打卡天数计算
- [ ] 累计被骂次数
- [ ] 项目进度展示

### 4.3 周四：日历视图

- [ ] 周度日历组件（`app/(tabs)/calendar.tsx`）
  - 按周展示
  - 糖果色编码（绿/黄/红/灰）
  - 周日结算标记
  - 左右滑动切换周
- [ ] 日期详情抽屉（点击日期弹出）
- [ ] 点击周日 📊 查看历史周报

### 4.4 周五：UI 打磨 + Bug 修复

- [ ] 打卡完成动效（800ms 庆祝动画）
- [ ] 周报评级动效（1200ms 游戏通关式）
- [ ] 吐槽气泡弹出动效（500ms）
- [ ] 骨架屏加载
- [ ] 空状态插画完善
- [ ] 暗色模式适配
- [ ] Bug 修复 + 边界情况处理

#### 周末交付
> **Week 4 Checkpoint**：可提交 TestFlight 的完整 MVP 版本。

---

## 5. 每日开发节奏建议

| 时段 | 建议内容 | 说明 |
|------|---------|------|
| 上午 | 核心逻辑开发 | 数据库操作、业务引擎、API 调用 |
| 下午 | UI 联调 | 组件实现、样式调整、动效 |
| 晚间 | 自测 | 手动测试主要流程，记录 Bug |

### 5.1 AI Agent 协作建议

如果使用多个 AI Agent 并行开发：

- **Agent A**：负责数据库 + 核心引擎（rolloverEngine、roastEngine）
- **Agent B**：负责页面 + UI 组件（TaskCard、ProjectCard 等）
- **Agent C**：负责 AI 集成 + 工具函数（Claude API、Markdown 解析）

**协作要点**：
1. 每个 Agent 开始前阅读 TECH_SPEC.md 中的数据模型定义
2. 共享 `src/db/schema.ts` 作为数据契约
3. 使用 TypeScript 接口确保类型一致
4. 每日合并代码前做一次集成检查

---

## 6. 里程碑检查点汇总

| 检查点 | 时间 | 验收标准 |
|--------|------|---------|
| **Checkpoint 1** | Week 1 结束 | 可创建项目、添加里程碑、数据库正确存储 |
| **Checkpoint 2** | Week 2 结束 | 完整的 项目 → 子任务 → AI 拆解 → 打卡 链路 |
| **Checkpoint 3** | Week 3 结束 | 延期 → 吐槽 → 通知 完整闭环可运行 |
| **Checkpoint 4** | Week 4 结束 | 可提交 TestFlight 的完整 MVP（含周报、统计、日历） |

---

## 7. 风险与应对

| 风险 | 影响 | 应对策略 | 排期影响 |
|------|------|---------|---------|
| WatermelonDB 集成问题 | 数据库搭建延期 | 准备 expo-sqlite 作为 fallback | +1 天 |
| AI API 响应不稳定 | AI 拆解体验差 | 做好超时、重试、手动创建 fallback | 不影响主线 |
| iOS 通知权限引导复杂 | 推送功能延期 | 先用最简单的方式注册通知，后续迭代 | 不影响主线 |
| 动画性能问题 | 动效卡顿 | 使用 reanimated 的 worklet，避免 JS 线程阻塞 | 可能在 Week 4 需要额外时间 |
| 吐槽文案质量不足 | 产品差异化减弱 | 优先保证每种级别至少 10 条，后续持续补充 | 可并行进行 |

---

## 8. 发布 Checklist

### 技术准备
- [ ] App 图标设计完成（3D 风格）
- [ ] App Store 截图完成（5 张，展示核心功能）
- [ ] App 描述和关键词编写
- [ ] TestFlight 内部测试通过
- [ ] 冷启动时间 < 2 秒
- [ ] 离线功能正常（AI 功能除外）

### 功能验收（参考 PRD 第 6.2 节）
- [ ] 用户可以创建至少 3 个项目
- [ ] 每个项目下可以创建至少 5 个子任务
- [ ] 首页正确展示当日所有任务实例（跨项目混排）
- [ ] 打卡功能正常工作（自动开始、完成、放弃）
- [ ] 未完成任务在次日自动生成延期实例
- [ ] 延期任务展示对应级别的吐槽文案
- [ ] 循环子任务不显示"延期"按钮
- [ ] 吐槽文案随机轮换，3 天内不重复
- [ ] 周结算报告在周日自动生成，评语分级正确
- [ ] 推送通知在指定时间触发
- [ ] 统计数据和日历视图数据准确
- [ ] 骂人烈度切换功能正常
