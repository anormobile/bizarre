local json = require "util.json";
local hosts = prosody.hosts;

module:depends("http");

local function get_sessions()
  local result = {};
  for hostname, host_obj in pairs(hosts) do
    if host_obj.sessions then
      for username, user_session in pairs(host_obj.sessions) do
        if user_session.sessions then
          for _, session in pairs(user_session.sessions) do
            local ip = session.ip or "unknown";
            local since = math.floor(session.conntime or os.time());
            table.insert(result, {
              jid = username .. "@" .. hostname,
              domain = hostname,
              remoteIp = ip,
              since = os.date("!%Y-%m-%dT%H:%M:%SZ", since),
            });
          end
        end
      end
    end
  end
  return result;
end

module:provides("http", {
  route = {
    ["GET /sessions"] = function(event)
      local sessions = get_sessions();
      event.response.headers["Content-Type"] = "application/json";
      return json.encode({ sessions = sessions });
    end;
  };
});
