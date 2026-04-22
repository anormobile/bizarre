-- seed data loaded after schema

INSERT INTO users (id, email, username, password_hash)
VALUES
  (gen_random_uuid(), 'alice@xmpp-a', 'alice', 'scrypt$N=16384,r=8,p=1$6c31df990ba7e648b6f9e992a098bbb4$da747fee64146205960daf82e858b415627c2fd3ad169231e4814be8005b408b8cd9e439a3aac9224326300b8f06eb89596d4a40dc02aacba4632107ff1e1546'),
  (gen_random_uuid(), 'bob@xmpp-b', 'bob', 'scrypt$N=16384,r=8,p=1$a2e2af2d4f148eac401b523082436370$40eb86175847a6c240893c828db9a87d365d1c6767888bee573b2aebf59e21c146c84bce5c628e027e382c75a28f23cb926ff4283342da49c04405961fbd7e90')
ON CONFLICT (email) DO NOTHING;
