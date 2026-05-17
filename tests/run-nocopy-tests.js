#!/usr/bin/env node
/**
 * 多人聊天模式防复制测试
 * 验证：多个成员在同一话题下不会输出相同的句子/短语
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_KEY = process.argv[3] || process.env.TEST_AI_API_KEY || '';
const PROVIDER = process.argv[4] || process.env.TEST_AI_PROVIDER || 'bailian';
const MODEL = process.env.TEST_AI_MODEL || 'qwen-plus';

const TEST_USER_ID = 'test-nocopy-' + Date.now().toString(36);

const config = { provider: PROVIDER, apiKey: API_KEY, model: MODEL };

let passCount = 0;
let failCount = 0;

function pass(name, detail = '') { passCount++; console.log(`  ✅ PASS: ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name, error = '') { failCount++; console.error(`  ❌ FAIL: ${name}${error ? ' — ' + error : ''}`); }

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
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

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

  const events = [];
  for (const block of fullText.split('\n\n')) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    const eventType = lines.find(l => l.startsWith('event: '))?.slice(7);
    const dataLine = lines.find(l => l.startsWith('data: '))?.slice(6);
    if (eventType && dataLine) {
      try { events.push({ type: eventType, data: JSON.parse(dataLine) }); } catch { events.push({ type: eventType, data: dataLine }); }
    }
  }
  return events;
}

function extractSentences(content) {
  // Split into sentences (Chinese and English punctuation)
  return content.split(/[。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 8); // Skip short fragments
}

function findSharedPhrases(sentencesA, sentencesB, minLength = 6) {
  // Find phrases of minLength+ consecutive characters that appear in both
  const shared = [];
  for (const a of sentencesA) {
    for (const b of sentencesB) {
      // Find common substrings of minLength+ chars
      for (let i = 0; i <= a.length - minLength; i++) {
        const phrase = a.slice(i, i + minLength);
        if (b.includes(phrase) && !shared.find(s => s.includes(phrase))) {
          shared.push(phrase);
        }
      }
    }
  }
  // Filter out generic/common phrases
  const generic = ['关键在', '我跟', '我跟人', '我跟团队', '我跟合伙人', '我跟人家', '我跟人打', '我跟人交', '我跟人合'];
  return shared.filter(p => !generic.includes(p) && p.length >= minLength);
}

async function testNoCopy(nameA, nameB, idA, idB, question) {
  section(`${nameA} vs ${nameB} — 防复制测试`);
  console.log(`  问题：${question}`);

  try {
    const events = await fetchSSE('/api/chat', {
      question,
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: [idA, idB],
    });

    const msgEvents = events.filter(e => e.type === 'message_complete');
    const msgA = msgEvents.find(e => e.data.speakerName === nameA);
    const msgB = msgEvents.find(e => e.data.speakerName === nameB);

    const contentA = msgA?.data?.content || '';
    const contentB = msgB?.data?.content || '';

    if (!msgA || !msgB) {
      fail('两位成员都发言', `找到: ${msgEvents.map(e => e.data.speakerName).join(', ')}`);
      return;
    }

    // Basic quality
    if (contentA.length >= 50) pass(`${nameA} 内容长度`, `${contentA.length} chars`);
    else fail(`${nameA} 内容长度`, `${contentA.length} chars`);

    if (contentB.length >= 50) pass(`${nameB} 内容长度`, `${contentB.length} chars`);
    else fail(`${nameB} 内容长度`, `${contentB.length} chars`);

    // Check for shared sentences (not short common phrases)
    const sentencesA = extractSentences(contentA);
    const sentencesB = extractSentences(contentB);

    // Check for near-identical sentences (Jaccard similarity on words)
    const identicalSentences = [];
    for (const a of sentencesA) {
      for (const b of sentencesB) {
        // Check if sentences are nearly identical (>70% character overlap)
        const charsA = new Set(a);
        const charsB = new Set(b);
        let overlap = 0;
        for (const c of charsA) { if (charsB.has(c)) overlap++; }
        const similarity = overlap / Math.max(charsA.size, charsB.size);
        // Require >75% similarity AND sentence must be >15 chars to avoid false positives on short phrases
        if (similarity > 0.75 && a.length > 15 && b.length > 15) {
          identicalSentences.push({ a: a.slice(0, 40), b: b.slice(0, 40), similarity });
        }
      }
    }

    // Also check for exact repeated phrases of 8+ chars
    const sharedPhrases = findSharedPhrases(sentencesA, sentencesB, 8);
    const longSharedPhrases = sharedPhrases.filter(p => p.length >= 10);

    if (identicalSentences.length === 0 && longSharedPhrases.length === 0) {
      pass('无复制句子', '两位成员各自独立表达');
    } else {
      const issues = [];
      for (const item of identicalSentences) {
        issues.push(`[${item.similarity.toFixed(1)}] "${item.a}" ≈ "${item.b}"`);
      }
      for (const p of longSharedPhrases.slice(0, 5)) {
        issues.push(`共享短语: "${p}"`);
      }
      fail('无复制句子', issues.join('\n    '));
    }

    // Show content for debugging
    console.log(`\n  ${nameA} 内容: "${contentA.slice(0, 150)}..."`);
    console.log(`  ${nameB} 内容: "${contentB.slice(0, 150)}..."`);
    console.log();

  } catch (err) {
    fail('测试异常', err.message);
  }
}

async function runTests() {
  console.log(`\n  多人聊天模式 — 防复制测试`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  供应商: ${config.provider} / ${config.model}`);

  // Test different pairs
  await testNoCopy('埃隆·马斯克', '查理·芒格', 'musk', 'munger',
    '如何建立和维护高质量的人际关系？');

  await testNoCopy('安德烈·卡帕西', '张一鸣', 'karpathy', 'zhangyiming',
    'AI 时代个人如何保持竞争力？');

  await testNoCopy('保罗·格雷厄姆', '张一鸣', 'paulgraham', 'zhangyiming',
    '创业初期应该关注什么？');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  总计: ${passCount} 通过 / ${failCount} 失败`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => { console.error('Error:', err); process.exit(1); });
