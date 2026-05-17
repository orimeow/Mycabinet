#!/usr/bin/env node
/**
 * 5人发言质量全场景测试
 *
 * 用法：node tests/run-quality-tests.js http://localhost:3000 API_KEY bailian
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_KEY = process.argv[3] || process.env.TEST_AI_API_KEY || '';
const PROVIDER = process.argv[4] || process.env.TEST_AI_PROVIDER || 'bailian';
const MODEL = process.env.TEST_AI_MODEL || (PROVIDER === 'bailian' ? 'qwen-plus' : 'google/gemma-4-31b-it:free');

const TEST_USER_ID = 'test-quality-' + Date.now().toString(36);

const config = {
  provider: PROVIDER,
  apiKey: API_KEY,
  model: MODEL,
};

// All 5 members
const ALL_MEMBERS = [
  { id: 'karpathy', name: '安德烈·卡帕西' },
  { id: 'paulgraham', name: '保罗·格雷厄姆' },
  { id: 'musk', name: '埃隆·马斯克' },
  { id: 'zhangyiming', name: '张一鸣' },
  { id: 'munger', name: '查理·芒格' },
];

let passCount = 0;
let failCount = 0;
let totalTests = 0;

function recordPass(name, detail = '') {
  totalTests++;
  passCount++;
  console.log(`  ✅ PASS: ${name}${detail ? ' — ' + detail : ''}`);
}

function recordFail(name, error = '') {
  totalTests++;
  failCount++;
  console.error(`  ❌ FAIL: ${name}${error ? ' — ' + error : ''}`);
}

function section(name) {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${'━'.repeat(60)}`);
}

async function fetchSSE(endpoint, body) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    fullText += buffer;
    buffer = '';
  }

  // Parse SSE events
  const events = [];
  const blocks = fullText.split('\n\n');
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    const eventType = lines.find(l => l.startsWith('event: '))?.slice(7);
    const dataLine = lines.find(l => l.startsWith('data: '))?.slice(6);
    if (eventType && dataLine) {
      try {
        events.push({ type: eventType, data: JSON.parse(dataLine) });
      } catch {
        events.push({ type: eventType, data: dataLine });
      }
    }
  }
  return events;
}

function analyzeMessage(content, memberName) {
  const results = [];

  if (!content || content.length < 10) {
    results.push({ pass: false, msg: '内容过短或为空', detail: `${content?.length || 0} chars` });
    return results;
  }

  if (content.includes('[发言失败') || content.includes('[回复失败')) {
    results.push({ pass: false, msg: 'AI 回复失败', detail: content.slice(0, 100) });
    return results;
  }

  // Silence check
  const silencePatterns = ['我没什么要补充的', '我没什么可说的', '我没什么好补充的', '没什么要补充的', '没什么好补充的', '我没什么补充的'];
  const hasSilence = silencePatterns.some(p => content.includes(p));
  if (hasSilence) {
    results.push({ pass: false, msg: '沉默式回应', detail: `"${content.slice(0, 60)}"` });
  }

  // Capability boundary check
  const boundaryPatterns = ['能力圈之外', '不在我的能力范围内', '这超出了我的能力'];
  const hasBoundary = boundaryPatterns.some(p => content.includes(p));
  if (hasBoundary) {
    results.push({ pass: false, msg: '能力圈回避', detail: `"${content.slice(0, 60)}"` });
  }

  // Length
  if (content.length >= 50) {
    results.push({ pass: true, msg: '内容长度达标', detail: `${content.length} chars` });
  } else if (content.length >= 30) {
    results.push({ pass: true, msg: '内容长度勉强达标', detail: `${content.length} chars` });
  } else {
    results.push({ pass: false, msg: '内容过短', detail: `${content.length} chars` });
  }

  // Markdown format check (should NOT use markdown headings)
  const hasHeadings = /^#{1,3}\s/m.test(content);
  if (hasHeadings) {
    results.push({ pass: false, msg: '使用了 markdown 标题', detail: '违反"不用#格式"的指令' });
  }

  return results;
}

async function testMemberQuality(memberId, memberName, question) {
  section(`${memberName} — 发言质量测试`);
  console.log(`  问题：${question}`);

  try {
    const events = await fetchSSE('/api/chat', {
      question,
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: [memberId],
    });

    const msgEvents = events.filter(e => e.type === 'message_complete');
    const speakerMsg = msgEvents.find(e => e.data.speakerName === memberName);
    const content = speakerMsg?.data?.content || '';

    if (!speakerMsg) {
      recordFail(`${memberName} 发言`, '未在 message_complete 中找到');
      return;
    }

    // Basic check
    if (events.some(e => e.type === 'discussion_started')) {
      recordPass(`${memberName} SSE 流程正常`);
    }

    const errors = events.filter(e => e.type === 'error');
    if (errors.length > 0) {
      recordFail(`${memberName} 无错误`, errors.map(e => JSON.stringify(e.data.message || e.data)).join('; '));
      return;
    } else {
      recordPass(`${memberName} 无流错误`);
    }

    // Detailed analysis
    const analysis = analyzeMessage(content, memberName);
    for (const a of analysis) {
      if (a.pass) {
        recordPass(`${memberName}: ${a.msg}`, a.detail);
      } else {
        recordFail(`${memberName}: ${a.msg}`, a.detail);
      }
    }

    // Show first 100 chars of content for debugging
    console.log(`  📝 内容预览: "${content.slice(0, 120)}..."`);
    console.log();
  } catch (err) {
    recordFail(`${memberName} 测试异常`, err.message);
  }
}

async function runTests() {
  console.log(`\n  内阁决策系统 — 5人发言质量全场景测试`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  供应商: ${config.provider} / ${config.model}`);
  console.log(`  测试用户: ${TEST_USER_ID}`);

  // ============================================================
  // Individual quality tests
  // ============================================================

  // Karpathy
  await testMemberQuality('karpathy', '安德烈·卡帕西',
    'AI 编程助手真的能帮工程师提高效率吗？还是只是暂时的新鲜感？');

  // Paul Graham
  await testMemberQuality('paulgraham', '保罗·格雷厄姆',
    '创业初期应该先做完美的商业计划还是先做出 MVP 给用户用？');

  // Musk
  await testMemberQuality('musk', '埃隆·马斯克',
    '如何平衡工作和生活，避免职业倦怠？');

  // Zhang Yiming
  await testMemberQuality('zhangyiming', '张一鸣',
    '面对重大决策时，如何克服选择困难症？');

  // Munger
  await testMemberQuality('munger', '查理·芒格',
    '普通人如何在投资中避免犯大错？');

  // ============================================================
  // Follow-up consistency tests
  // ============================================================
  section('Follow-up 一致性测试 — 芒格');
  try {
    // First message
    const events1 = await fetchSSE('/api/chat', {
      question: '投资中应该追求高收益还是低风险的稳定回报？',
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: ['munger'],
    });

    const dId = events1.find(e => e.type === 'discussion_started')?.data?.discussionId;
    const msg1 = events1.find(e => e.type === 'message_complete' && e.data.speakerName === '查理·芒格');
    const content1 = msg1?.data?.content || '';

    if (content1.length >= 30) {
      recordPass('芒格首轮回复', `${content1.length} chars`);
    } else {
      recordFail('芒格首轮回复', `仅 ${content1.length} chars`);
    }

    // Follow-up message
    const events2 = await fetchSSE('/api/chat', {
      message: '能举一个具体的例子吗？',
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: ['munger'],
      discussionId: dId,
    });

    const msg2 = events2.find(e => e.type === 'message_complete' && e.data.speakerName === '查理·芒格');
    const content2 = msg2?.data?.content || '';

    if (content2.length >= 20) {
      recordPass('芒格 follow-up 回复', `${content2.length} chars`);
    } else {
      recordFail('芒格 follow-up 回复', `仅 ${content2.length} chars`);
    }

    if (content1 && content2 && content1 !== content2) {
      recordPass('芒格两轮回复不同', '内容不重复');
    } else if (content1 === content2 && content1.length > 0) {
      recordFail('芒格两轮回复', '内容完全相同（缓存问题）');
    }

    // Check same discussion
    const dId2 = events2.find(e => e.type === 'discussion_started')?.data?.discussionId;
    if (dId === dId2) {
      recordPass('discussionId 一致', dId);
    } else {
      recordFail('discussionId 一致', `首轮=${dId}, follow-up=${dId2}`);
    }
  } catch (err) {
    recordFail('Follow-up 一致性测试', err.message);
  }

  // ============================================================
  // Musk repetition check
  // ============================================================
  section('马斯克框架重复度测试');
  try {
    const events = await fetchSSE('/api/chat', {
      question: '面对气候变化，个人、企业和政府应该如何分工？',
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: ['musk'],
    });

    const msg = events.find(e => e.type === 'message_complete' && e.data.speakerName === '埃隆·马斯克');
    const content = msg?.data?.content || '';

    const frameworkPhrases = {
      '白痴指数': (content.match(/白痴指数/g) || []).length,
      '物理定律': (content.match(/物理定律/g) || []).length,
      '渐近极限': (content.match(/渐近极限/g) || []).length,
      '第一性原理': (content.match(/第一性原理/g) || []).length,
    };

    const total = Object.values(frameworkPhrases).reduce((a, b) => a + b, 0);
    const used = Object.entries(frameworkPhrases).filter(([, c]) => c > 0);

    if (total === 0) {
      recordPass('马斯克框架词使用', '未机械套用标志性概念');
    } else if (total <= 3) {
      recordPass('马斯克框架词使用', `共 ${total} 次，在合理范围内`);
    } else {
      recordFail('马斯克框架词使用', `共 ${total} 次: ${used.map(([w, c]) => `${w}×${c}`).join(', ')}`);
    }
  } catch (err) {
    recordFail('马斯克框架重复度测试', err.message);
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  测试总览: ${passCount} 通过 / ${failCount} 失败 / ${totalTests} 总计`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
