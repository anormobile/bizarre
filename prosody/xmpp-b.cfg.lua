plugin_paths = { "/usr/lib/prosody/modules-extra" }

pidfile = "/var/run/prosody/prosody.pid"
admins = { }

modules_enabled = {
  "roster"; "saslauth"; "dialback"; "disco";
  "carbons"; "pep"; "private"; "blocklist"; "vcard4"; "vcard_legacy";
  "version"; "uptime"; "time"; "ping"; "register";
  "http"; "admin_adhoc";
}

allow_registration = false

authentication = "custom_http"
http_auth_url = "http://app:3000/api/internal/xmpp-auth"

allow_unencrypted_plain_auth = true
s2s_secure_auth = false
s2s_require_encryption = false
c2s_require_encryption = false

statistics = "internal"
statistics_interval = 10
http_ports = { 5280 }
http_interfaces = { "*" }

VirtualHost "xmpp-b"
  http_host = "xmpp-b"
