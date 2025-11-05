const upstreamType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
const text = await upstream.text();

res.status(upstream.status);
res.setHeader("Content-Type", upstreamType);

try {
  const json = JSON.parse(text);
  return res.send(json);
} catch {
  return res.send(text);
}
