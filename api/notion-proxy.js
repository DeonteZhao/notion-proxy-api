module.exports = async (req, res) => {
  // 1) 统一设置 CORS 响应头（所有返回路径都要有）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type');

  // 2) 预检请求：直接 204
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 3) 限制仅允许 POST
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
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
      res.statusCode = 400;
      res.end('Invalid JSON body');
      return;
    }
  } else if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      res.statusCode = 400;
      res.end('Invalid JSON body');
      return;
    }
  }

  const { databaseId, sorts, filter } = payload || {};
  if (!databaseId) {
    res.statusCode = 400;
    res.end('Missing databaseId');
    return;
  }

  // 5) 环境变量
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
  if (!NOTION_TOKEN) {
    res.statusCode = 500;
    res.end('Server misconfigured: NOTION_TOKEN is missing');
    return;
  }

  // 6) 转发到 Notion
  const notionUrl = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const upstreamBody = {
    ...(Array.isArray(sorts) ? { sorts } : {}),
    ...(filter ? { filter } : {})
  };

  try {
    const upstream = await fetch(notionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(upstreamBody)
    });

    const upstreamType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    const text = await upstream.text();

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstreamType);

    try {
      const json = JSON.parse(text);
      res.end(JSON.stringify(json));
      return;
    } catch {
      res.end(text);
      return;
    }
  } catch (err) {
    // 7) 错误兜底（仍带 CORS 头）
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Proxy error: ${(err && err.message) || String(err)}`);
  }
};
