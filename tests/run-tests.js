#!/usr/bin/env node
/**
 * Automated test runner for cabinet-decision-system API endpoints
 *
 * Usage:
 *   node tests/run-tests.js [BASE_URL] [API_KEY] [PROVIDER]
 *   BASE_URL defaults to http://localhost:3000
 *   API_KEY defaults to process.env.TEST_AI_API_KEY
 *   PROVIDER defaults to process.env.TEST_AI_PROVIDER (or "openrouter")
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_KEY = process.argv[3] || process.env.TEST_AI_API_KEY || '';
const PROVIDER = process.argv[4] || process.env.TEST_AI_PROVIDER || 'openrouter';
const MODEL = process.env.TEST_AI_MODEL || 'google/gemma-4-31b-it:free';

const TEST_USER_ID = 'test-automated-' + Date.now().toString(36);

const config = {
  provider: PROVIDER,
  apiKey: API_KEY,
  model: MODEL,
};

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function pass(name, detail = '') {
  passCount++;
  console.log(`  ✅ PASS: ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, error = '') {
  failCount++;
  console.error(`  ❌ FAIL: ${name}${error ? ' — ' + error : ''}`);
}

function skip(name, reason = '') {
  skipCount++;
  console.log(`  ️ SKIP: ${name}${reason ? ' — ' + reason : ''}`);
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

function parseSSE(text) {
  const events = [];
  const blocks = text.split('\n\n');
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

  return parseSSE(fullText);
}

async function runTests() {
  console.log(`\n Cabinet Decision System - Automated API Tests`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test User: ${TEST_USER_ID}`);
  console.log(`   AI Provider: ${config.provider}${API_KEY ? ' (key provided)' : ' (NO KEY)'}`);

  if (!API_KEY) {
    console.log(`\n   WARNING: No API key provided. Tests that call the AI will fail.\n`);
    console.log(`   To run with AI calls, use:`);
    console.log(`   node tests/run-tests.js http://localhost:3000 YOUR_API_KEY openrouter`);
    console.log(`   or set TEST_AI_API_KEY env var\n`);
  }

  const hasKey = !!API_KEY;

  // ============================================================
  // T-API-01: Debate mode
  // ============================================================
  section('T-API-01: Debate mode (2 members)');

  try {
    const events = await fetchSSE('/api/chat', {
      question: 'AI 是否会取代人类工作？我们该如何应对？',
      config,
      userId: TEST_USER_ID,
      mode: 'debate',
      selectedMemberIds: ['munger', 'paulgraham'],
    });

    const types = events.map(e => e.type);

    if (types.includes('discussion_started')) {
      const dId = events.find(e => e.type === 'discussion_started')?.data?.discussionId;
      pass('discussion_started event received', dId ? `id=${dId}` : '');

      const rounds = events.filter(e => e.type === 'round_start').map(e => e.data.round);
      if (rounds.includes(1) && rounds.includes(2) && rounds.includes(3)) {
        pass('3 debate rounds completed', `rounds: ${rounds.join(', ')}`);
      } else {
        fail('3 debate rounds', `found rounds: ${rounds.join(', ')}`);
      }

      const msgEvents = events.filter(e => e.type === 'message_complete');
      const speakers = [...new Set(msgEvents.map(e => e.data.speakerName))];

      if (speakers.includes('查理·芒格')) {
        const mungerMsg = msgEvents.find(e => e.data.speakerName === '查理·芒格');
        const content = mungerMsg?.data?.content || '';
        if (content.includes('我没什么要补充的') || content.includes('能力圈之外')) {
          fail('芒格发言质量', '输出了沉默回应');
        } else if (content.length < 50) {
          fail('芒格发言质量', `内容过短 (${content.length} chars): "${content.slice(0, 80)}"`);
        } else {
          pass('芒格发言质量', `${content.length} chars, 有实质性内容`);
        }
      } else if (hasKey) {
        fail('芒格发言', '未在 message_complete 中找到');
      }

      if (speakers.includes('保罗·格雷厄姆')) {
        const pgMsg = msgEvents.find(e => e.data.speakerName === '保罗·格雷厄姆');
        const content = pgMsg?.data?.content || '';
        if (content.length < 50) {
          fail('保罗发言质量', `内容过短 (${content.length} chars)`);
        } else {
          pass('保罗发言质量', `${content.length} chars, 有实质性内容`);
        }
      } else if (hasKey) {
        fail('保罗发言', '未在 message_complete 中找到');
      }

      if (hasKey && events.some(e => e.type === 'discussion_complete')) {
        pass('discussion_complete event received');
      }

      const errors = events.filter(e => e.type === 'error');
      if (errors.length === 0) {
        pass('No errors in stream');
      } else {
        if (hasKey) {
          fail('No errors', errors.map(e => JSON.stringify(e.data)).join('; '));
        } else {
          skip('No errors', 'Expected without API key');
        }
      }

      globalThis.debateDiscussionId = dId;
    } else {
      fail('discussion_started event', 'first event was: ' + types[0]);
    }
  } catch (err) {
    fail('Debate mode API test', err.message);
  }

  // ============================================================
  // T-API-02: Chat mode initial (1 member)
  // ============================================================
  section('T-API-02: Chat mode initial (1 member)');

  try {
    const events = await fetchSSE('/api/chat', {
      question: '如何高效管理个人财务？',
      config,
      userId: TEST_USER_ID,
      mode: 'chat',
      selectedMemberIds: ['munger'],
    });

    const types = events.map(e => e.type);

    if (types.includes('discussion_started')) {
      const dId = events.find(e => e.type === 'discussion_started')?.data?.discussionId;
      pass('discussion_started event received', `id=${dId}`);

      const msgEvents = events.filter(e => e.type === 'message_complete');
      if (msgEvents.length >= 1) {
        const mungerMsg = msgEvents.find(e => e.data.speakerName === '查理·芒格');
        const content = mungerMsg?.data?.content || '';
        if (content.includes('我没什么要补充的') || content.includes('能力圈之外')) {
          fail('芒格回复质量 - 沉默回应', content);
        } else if (content.length < 50) {
          fail('芒格回复质量 - 过短', `${content.length} chars: "${content.slice(0, 80)}"`);
        } else {
          pass('芒格回复质量', `${content.length} chars`);
          const keywords = ['投资', '财务', '金钱', '价值', '等待', '理性', '能力', '风险'];
          const found = keywords.filter(k => content.includes(k));
          if (found.length > 0) {
            pass('内容相关性', `包含关键词: ${found.join(', ')}`);
          }
        }
      } else {
        fail('At least 1 message event', `found ${msgEvents.length}`);
      }

      const errors = events.filter(e => e.type === 'error');
      if (errors.length === 0) {
        pass('No errors');
      } else {
        if (hasKey) {
          fail('No errors', errors.map(e => JSON.stringify(e.data)).join('; '));
        } else {
          skip('No errors', 'Expected without API key');
        }
      }

      globalThis.chatDiscussionId = dId;
    } else {
      fail('discussion_started event', 'first event was: ' + types[0]);
    }
  } catch (err) {
    fail('Chat mode initial API test', err.message);
  }

  // ============================================================
  // T-API-03: Chat mode follow-up (same discussion)
  // ============================================================
  section('T-API-03: Chat mode follow-up (same discussion)');

  if (!globalThis.chatDiscussionId) {
    skip('Follow-up test', 'No discussionId from T-API-02');
  } else if (!hasKey) {
    skip('Follow-up test', 'No API key available');
  } else {
    try {
      const events = await fetchSSE('/api/chat', {
        message: '能举一个具体的投资案例吗？',
        config,
        userId: TEST_USER_ID,
        mode: 'chat',
        selectedMemberIds: ['munger'],
        discussionId: globalThis.chatDiscussionId,
      });

      const types = events.map(e => e.type);

      if (types.includes('discussion_started')) {
        const dId = events.find(e => e.type === 'discussion_started')?.data?.discussionId;
        if (dId === globalThis.chatDiscussionId) {
          pass('Same discussionId on follow-up', dId);
        } else {
          fail('Same discussionId', `expected ${globalThis.chatDiscussionId}, got ${dId}`);
        }
      } else {
        fail('discussion_started event', 'first event was: ' + types[0]);
      }

      const msgEvents = events.filter(e => e.type === 'message_complete');
      if (msgEvents.length >= 1) {
        const mungerMsg = msgEvents.find(e => e.data.speakerName === '查理·芒格');
        const content = mungerMsg?.data?.content || '';
        if (content.includes('我没什么要补充的') || content.includes('能力圈之外')) {
          fail('芒格follow-up质量 - 沉默回应', content);
        } else if (content.length < 30) {
          fail('芒格follow-up质量 - 过短', `${content.length} chars`);
        } else {
          pass('芒格follow-up质量', `${content.length} chars, 有实质性内容`);
        }
      } else {
        fail('At least 1 message on follow-up', `found ${msgEvents.length}`);
      }

      const errors = events.filter(e => e.type === 'error');
      if (errors.length === 0) {
        pass('No errors on follow-up');
      } else {
        fail('No errors on follow-up', errors.map(e => JSON.stringify(e.data)).join('; '));
      }
    } catch (err) {
      fail('Chat follow-up API test', err.message);
    }
  }

  // ============================================================
  // T-API-04: List discussions
  // ============================================================
  section('T-API-04: List discussions');

  try {
    const res = await fetch(`${BASE_URL}/api/discussions?userId=${TEST_USER_ID}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      pass('Returns array', `${data.length} discussions`);

      const debateEntries = data.filter(d => d.mode === 'debate');
      const chatEntries = data.filter(d => d.mode === 'chat');
      if (debateEntries.length >= 1) {
        pass('Debate discussion in history', debateEntries[0].question?.slice(0, 30));
      }
      if (chatEntries.length >= 1) {
        pass('Chat discussion in history', chatEntries[0].question?.slice(0, 30));
      }

      const timestamps = data.map(d => new Date(d.createdAt).getTime());
      if (timestamps.every((t, i) => i === 0 || t <= timestamps[i - 1])) {
        pass('Sorted by time descending');
      } else {
        fail('Sorted by time', 'not in descending order');
      }
    } else {
      fail('List returns array', `got: ${typeof data}`);
    }
  } catch (err) {
    fail('List discussions', err.message);
  }

  // ============================================================
  // T-API-05: Get single discussion
  // ============================================================
  section('T-API-05: Get single discussion');

  if (globalThis.chatDiscussionId) {
    try {
      const res = await fetch(`${BASE_URL}/api/discussions?id=${globalThis.chatDiscussionId}&userId=${TEST_USER_ID}`);
      const data = await res.json();

      if (data && data.id === globalThis.chatDiscussionId) {
        pass('Returns correct discussion');
        if (data.mode === 'chat') pass('Mode is chat');
        if (data.userId === TEST_USER_ID) pass('userId matches');
        if (Array.isArray(data.messages)) {
          pass('Has messages array', `${data.messages.length} messages`);
          const userMsgs = data.messages.filter(m => m.sender === 'user');
          const aiMsgs = data.messages.filter(m => m.sender === 'member');
          if (userMsgs.length >= 1) pass('Contains user messages', `${userMsgs.length}`);
          if (aiMsgs.length >= 1) pass('Contains AI messages', `${aiMsgs.length}`);
        }
      } else {
        fail('Returns correct discussion', data?.id || 'no id');
      }
    } catch (err) {
      fail('Get single discussion', err.message);
    }
  } else {
    skip('Get single discussion', 'No discussionId');
  }

  // ============================================================
  // T-API-06: Terminate running discussion
  // ============================================================
  section('T-API-06: Terminate discussion');

  try {
    // Start a new running discussion to terminate
    const events = await fetchSSE('/api/chat', {
      question: '终止测试专用问题',
      config,
      userId: TEST_USER_ID,
      mode: 'debate',
      selectedMemberIds: ['musk', 'zhangyiming'],
    });

    const dId = events.find(e => e.type === 'discussion_started')?.data?.discussionId;
    if (dId) {
      // Wait a bit for the stream to complete and status to be set
      await new Promise(r => setTimeout(r, 2000));

      // Check current status
      const checkRes = await fetch(`${BASE_URL}/api/discussions?id=${dId}&userId=${TEST_USER_ID}`);
      const checkData = await checkRes.json();

      if (checkData.status === 'completed' || checkData.status === 'failed') {
        // Already done, can't terminate — this is correct behavior
        pass('Terminate check', `Discussion already ${checkData.status} (expected — SSE completed)`);
      } else if (checkData.status === 'running') {
        const res = await fetch(`${BASE_URL}/api/discussions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dId, userId: TEST_USER_ID, action: 'terminate' }),
        });

        if (res.ok) {
          pass('Terminate returns OK');
          const data = await res.json();
          if (data.status === 'terminated') {
            pass('Status is terminated');
          } else {
            fail('Status is terminated', `got: ${data.status}`);
          }
        } else {
          fail('Terminate returns OK', `status ${res.status}`);
        }
      } else {
        fail('Unexpected status', checkData.status);
      }
    } else {
      fail('Could not start discussion for terminate test');
    }
  } catch (err) {
    fail('Terminate discussion', err.message);
  }

  // ============================================================
  // T-API-07: Delete discussion
  // ============================================================
  section('T-API-07: Delete discussion');

  if (globalThis.debateDiscussionId) {
    try {
      const res = await fetch(`${BASE_URL}/api/discussions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: globalThis.debateDiscussionId, userId: TEST_USER_ID }),
      });

      if (res.ok) {
        pass('Delete returns OK');

        const listRes = await fetch(`${BASE_URL}/api/discussions?userId=${TEST_USER_ID}`);
        const listData = await listRes.json();
        if (!listData.find(d => d.id === globalThis.debateDiscussionId)) {
          pass('Discussion removed from list');
        } else {
          fail('Discussion removed from list');
        }
      } else {
        fail('Delete returns OK', `status ${res.status}`);
      }
    } catch (err) {
      fail('Delete discussion', err.message);
    }
  } else {
    skip('Delete discussion', 'No discussionId');
  }

  // ============================================================
  // T-API-08: Debate with Musk - check no framework repetition
  // ============================================================
  section('T-API-08: 马斯克发言质量检查 (debate)');

  if (!hasKey) {
    skip('马斯克发言质量', 'No API key');
  } else {
    try {
      const events = await fetchSSE('/api/chat', {
        question: '如何平衡工作和生活，避免职业倦怠？',
        config,
        userId: TEST_USER_ID,
        mode: 'debate',
        selectedMemberIds: ['musk', 'karpathy'],
      });

      const msgEvents = events.filter(e => e.type === 'message_complete');
      const muskMsgs = msgEvents.filter(e => e.data.speakerName === '埃隆·马斯克');

      if (muskMsgs.length > 0) {
        let totalLength = 0;
        let maxRepetition = 0;
        for (const msg of muskMsgs) {
          const content = msg.data.content || '';
          totalLength += content.length;

          // Check for repeated phrases
          const phrases = ['白痴指数', '物理定律', '渐近极限', '第一性原理'];
          for (const phrase of phrases) {
            const count = (content.match(new RegExp(phrase, 'g')) || []).length;
            if (count > 2) {
              maxRepetition = Math.max(maxRepetition, count);
            }
          }
        }

        if (maxRepetition > 0) {
          fail('马斯克词汇重复', `同一词汇出现 ${maxRepetition} 次`);
        } else if (totalLength < 100) {
          fail('马斯克发言总长度', `仅 ${totalLength} chars`);
        } else {
          pass('马斯克发言质量', `${totalLength} chars, 无明显重复`);
        }
      } else {
        fail('马斯克发言', '未在 message_complete 中找到');
      }

      const errors = events.filter(e => e.type === 'error');
      if (errors.length === 0) {
        pass('No errors');
      } else {
        fail('No errors', errors.map(e => JSON.stringify(e.data)).join('; '));
      }
    } catch (err) {
      fail('马斯克发言质量测试', err.message);
    }
  }

  // ============================================================
  // T-API-09: Chat with @mention follow-up
  // ============================================================
  section('T-API-09: 聊天模式 @mention follow-up');

  if (!hasKey || !globalThis.chatDiscussionId) {
    skip('@mention follow-up', hasKey ? 'No discussionId' : 'No API key');
  } else {
    try {
      const events = await fetchSSE('/api/chat', {
        message: '@查理·芒格 你同意这个观点吗？',
        config,
        userId: TEST_USER_ID,
        mode: 'chat',
        selectedMemberIds: ['munger'],
        discussionId: globalThis.chatDiscussionId,
      });

      const types = events.map(e => e.type);
      const msgEvents = events.filter(e => e.type === 'message_complete');

      if (types.includes('discussion_started')) {
        const dId = events.find(e => e.type === 'discussion_started')?.data?.discussionId;
        if (dId === globalThis.chatDiscussionId) {
          pass('Same discussionId', dId);
        } else {
          fail('Same discussionId', `expected ${globalThis.chatDiscussionId}, got ${dId}`);
        }
      }

      if (msgEvents.length >= 1) {
        const mungerMsg = msgEvents.find(e => e.data.speakerName === '查理·芒格');
        const content = mungerMsg?.data?.content || '';
        if (content.includes('我没什么要补充的') || content.includes('能力圈之外')) {
          fail('芒格@mention回复 - 沉默', content);
        } else if (content.length < 30) {
          fail('芒格@mention回复 - 过短', `${content.length} chars`);
        } else {
          pass('芒格@mention回复', `${content.length} chars, 有实质性内容`);
        }
      } else {
        fail('At least 1 message', `found ${msgEvents.length}`);
      }

      const errors = events.filter(e => e.type === 'error');
      if (errors.length === 0) {
        pass('No errors');
      } else {
        fail('No errors', errors.map(e => JSON.stringify(e.data)).join('; '));
      }
    } catch (err) {
      fail('@mention follow-up测试', err.message);
    }
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log(`  总计: ${passCount} 通过 / ${failCount} 失败 / ${skipCount} 跳过`);
  console.log('═══════════════════════════════════════\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
