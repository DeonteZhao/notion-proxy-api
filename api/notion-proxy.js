/**

- Vercel Serverless Function: /api/notion-proxy
- - 统一返回 CORS 头（所有返回路径）
- - 处理预检 OPTIONS（204）
- - 仅允许 POST 正式请求
- - 从环境变量读取 NOTION_TOKEN、NOTION_VERSION
- - 将前端传来的 databaseId、sorts、filter 转发到 Notion /v1/databases/{id}/query
    */
module.exports = async (req, res) => {
// 1) 统一设置 CORS 响应头（所有返回路径都要有）
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

// 2) 预检请求：直接 204
if (req.method === 'OPTIONS') {
return res.status(204).end();
}

// 3) 限制仅允许 POST
if (req.method !== 'POST') {
return res.status(405).send('Method Not Allowed');
}

// 4) 解析请求体（兼容 req.body 是对象或字符串，或未解析的情况）
let payload = req.body;
if (!payload || (typeof payload === 'string' && payload.trim() === '')) {
try {
const raw = await new Promise((resolve, reject) => {
let data = '';
req.on('data', chunk => { data += chunk; });
req.on('end', () => resolve(data));
req.on('error', reject);
});
payload = raw ? JSON.parse(raw) : {};
} catch (e) {
return res.status(400).send('Invalid JSON body');
}
} else if (typeof payload === 'string') {
try {
payload = JSON.parse(payload);
} catch {
return res.status(400).send('Invalid JSON body');
}
}

const { databaseId, sorts, filter } = payload || {};
if (!databaseId) {
return res.status(400).send('Missing databaseId');
}

// 5) 环境变量
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
if (!NOTION_TOKEN) {
return res.status(500).send('Server misconfigured: NOTION_TOKEN is missing');
}

// 6) 转发到 Notion
const notionUrl = https://api.notion.com/v1/databases/${databaseId}/query ;
const upstreamBody = {
...(Array.isArray(sorts) ? { sorts } : {}),
...(filter ? { filter } : {})
};

try {
const upstream = await fetch(notionUrl, {
method: 'POST',
headers: {
'Authorization': Bearer ${NOTION_TOKEN},
'Notion-Version': NOTION_VERSION,
'Content-Type': 'application/json'
},
body: JSON.stringify(upstreamBody)
});
  const upstreamType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
const text = await upstream.text();

res.status(upstream.status);
res.setHeader('Content-Type', upstreamType);

try {
  const json = JSON.parse(text);
  return res.send(json);
} catch {
  return res.send(text);
}
  } catch (err) {
// 7) 错误兜底（仍带 CORS 头）
res.status(500);
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
return res.send( Proxy error: ${(err && err.message) || String(err)} )
}
}
}
