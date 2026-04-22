local new_sasl = require "util.sasl".new;
local http = require "net.http";
local json = require "util.json";
local async = require "util.async";

local log = module._log;
local host = module.host;

local auth_url = module:get_option_string("http_auth_url", "http://app:3000/api/internal/xmpp-auth");
local auth_secret = os.getenv("XMPP_AUTH_SECRET") or "";

local provider = {};

function provider.test_password(username, password)
	local body = json.encode({ user = username, pass = password, host = host });
	local wait, done = async.waiter();
	local result = false;

	http.request(auth_url, {
		method = "POST";
		headers = {
			["Content-Type"] = "application/json";
			["x-xmpp-auth-secret"] = auth_secret;
		};
		body = body;
	}, function(resp_body, code)
		if code == 200 and resp_body then
			local parsed = json.decode(resp_body);
			if parsed and parsed.result == true then
				result = true;
			end
		end
		done();
	end);

	wait();
	return result;
end

function provider.get_password()
	return nil, "Not supported";
end

function provider.set_password()
	return nil, "Not supported";
end

function provider.user_exists(username)
	return true;
end

function provider.users()
	return function() return nil; end
end

function provider.create_user()
	return nil, "Not supported";
end

function provider.delete_user()
	return nil, "Not supported";
end

function provider.get_sasl_handler()
	local profile = {
		plain_test = function(sasl, username, password, realm)
			return provider.test_password(username, password), true;
		end;
	};
	return new_sasl(host, profile);
end

module:provides("auth", provider);
