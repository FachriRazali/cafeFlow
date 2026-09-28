-- Generated seed data — mirrors web/src/lib/store.ts demo cafes 1:1.
-- Safe to re-run: wraps everything in a transaction and clears prior demo rows first.
BEGIN;
DELETE FROM notification_logs; DELETE FROM table_status_logs; DELETE FROM payments;
DELETE FROM reservations; DELETE FROM menu_items; DELETE FROM cafe_staff;
DELETE FROM tables; DELETE FROM floors; DELETE FROM cafes;
DELETE FROM users WHERE email LIKE '%@cafeflow.demo';

-- Demo login accounts — one per role. Passwords (bcrypt-hashed below):
--   superadmin@cafeflow.demo / superadmin123  (unrestricted — creates cafes + staff accounts, see /admin)
--   merchant@cafeflow.demo   / merchant123    (scoped to cafe 101 via cafe_staff below)
--   cashier@cafeflow.demo    / cashier123     (scoped to cafe 101 via cafe_staff below)
--   admin@cafeflow.demo      / admin123       (scoped to cafe 101 via cafe_staff below)
--   fachri@privy.id          / customer123    (ordinary customer — not staff, no cafe scope)
INSERT INTO users (id, role_id, full_name, email, phone_number, password_hash) OVERRIDING SYSTEM VALUE VALUES
  (1, (SELECT id FROM roles WHERE code = 'merchant'),    'Demo Merchant', 'merchant@cafeflow.demo',    '+62811000001', '$2a$10$WAv9/aJEP1QgsK9MmaRebe1tmP839qagQhe3dOYSwjf629hIMJdAK'),
  (2, (SELECT id FROM roles WHERE code = 'cashier'),     'Demo Cashier',  'cashier@cafeflow.demo',     '+62811000002', '$2a$10$KBsWHBPrEsHIhcSwhHcXBO.XPJT07Om0Fkf3WIwLrXSuv33bw5AkW'),
  (3, (SELECT id FROM roles WHERE code = 'customer'),    'Fachri',        'fachri@privy.id',           '+62811000003', '$2a$10$vtesnWATd12XYRuQ2qgQduvMlmnB3WyWGJj6thU56omh5YHtxXx1a'),
  (4, (SELECT id FROM roles WHERE code = 'admin'),       'Demo Admin',    'admin@cafeflow.demo',       '+62811000004', '$2a$10$KjN9Yg34/ciN0ZG65lNmB.dKMc1zBk/yJUCDtcK.hmweew2J6P7oy'),
  (5, (SELECT id FROM roles WHERE code = 'super_admin'), 'Demo Super Admin', 'superadmin@cafeflow.demo', '+62811000005', '$2a$10$sV19sJD8Hp2NdhmBOwJZ4.kkxegZeYTZMVmOvKHmapVuPpbKXpbfq')
ON CONFLICT (id) DO UPDATE SET password_hash = excluded.password_hash;
SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT MAX(id) FROM users), 1));

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (101, 1, 2, 'Kopi Kina Senopati', 'kopi-kina-senopati', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Kopi Kina Senopati St.', -6.226, 106.81500000000001, '$$', '+62812000101', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80', true, 25000, 91, 4.7, 812);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1011, 101, 'Main Hall', 'indoor', 1, 640, 620, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (101101, 1011, 101, 'A1', 'round', 60, 60, 84, 84, 2, 'available'),
  (101102, 1011, 101, 'A2', 'square', 190, 60, 84, 84, 4, 'occupied'),
  (101103, 1011, 101, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'reserved'),
  (101104, 1011, 101, 'A4', 'round', 450, 60, 84, 84, 2, 'available'),
  (101105, 1011, 101, 'A5', 'square', 60, 190, 84, 84, 4, 'available'),
  (101106, 1011, 101, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'reserved'),
  (101107, 1011, 101, 'A7', 'round', 320, 190, 84, 84, 2, 'available'),
  (101108, 1011, 101, 'A8', 'square', 450, 190, 84, 84, 4, 'available'),
  (101109, 1011, 101, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'occupied'),
  (101110, 1011, 101, 'A10', 'round', 190, 320, 84, 84, 2, 'reserved'),
  (101111, 1011, 101, 'A11', 'square', 320, 320, 84, 84, 4, 'available'),
  (101112, 1011, 101, 'A12', 'rectangle', 450, 320, 120, 70, 6, 'occupied'),
  (101113, 1011, 101, 'A13', 'round', 60, 450, 84, 84, 2, 'reserved'),
  (101114, 1011, 101, 'A14', 'square', 190, 450, 84, 84, 4, 'available');
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1012, 101, 'Garden Patio', 'outdoor', 1, 640, 360, 1);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (101201, 1012, 101, 'OUT15', 'round', 60, 60, 84, 84, 2, 'reserved'),
  (101202, 1012, 101, 'OUT16', 'square', 190, 60, 84, 84, 4, 'available'),
  (101203, 1012, 101, 'OUT17', 'rectangle', 320, 60, 120, 70, 6, 'occupied'),
  (101204, 1012, 101, 'OUT18', 'round', 450, 60, 84, 84, 2, 'reserved'),
  (101205, 1012, 101, 'OUT19', 'square', 60, 190, 84, 84, 4, 'available'),
  (101206, 1012, 101, 'OUT20', 'rectangle', 190, 190, 120, 70, 6, 'available'),
  (101207, 1012, 101, 'OUT21', 'round', 320, 190, 84, 84, 2, 'reserved'),
  (101208, 1012, 101, 'OUT22', 'square', 450, 190, 84, 84, 4, 'available');

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (102, 1, 1, 'Kayu & Kabut Coffee', 'kayu-kabut-coffee', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Kayu & Kabut Coffee St.', -6.24, 106.799, '$$$', '+62812000102', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80', true, 50000, 84, 4.8, 540);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1021, 102, 'Ground Floor', 'indoor', 1, 640, 490, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (102101, 1021, 102, 'A1', 'round', 60, 60, 84, 84, 2, 'available'),
  (102102, 1021, 102, 'A2', 'square', 190, 60, 84, 84, 4, 'available'),
  (102103, 1021, 102, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'reserved'),
  (102104, 1021, 102, 'A4', 'round', 450, 60, 84, 84, 2, 'available'),
  (102105, 1021, 102, 'A5', 'square', 60, 190, 84, 84, 4, 'available'),
  (102106, 1021, 102, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'occupied'),
  (102107, 1021, 102, 'A7', 'round', 320, 190, 84, 84, 2, 'reserved'),
  (102108, 1021, 102, 'A8', 'square', 450, 190, 84, 84, 4, 'available'),
  (102109, 1021, 102, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'occupied'),
  (102110, 1021, 102, 'A10', 'round', 190, 320, 84, 84, 2, 'reserved'),
  (102111, 1021, 102, 'A11', 'square', 320, 320, 84, 84, 4, 'available'),
  (102112, 1021, 102, 'A12', 'rectangle', 450, 320, 120, 70, 6, 'available');

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (103, 1, 3, 'Warung Seduh Menteng', 'warung-seduh-menteng', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Warung Seduh Menteng St.', -6.1897, 106.8325, '$', '+62812000103', 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80', true, 10000, 76, 4.4, 331);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1031, 103, 'Indoor Hall', 'indoor', 1, 640, 490, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (103101, 1031, 103, 'A1', 'round', 60, 60, 84, 84, 2, 'available'),
  (103102, 1031, 103, 'A2', 'square', 190, 60, 84, 84, 4, 'available'),
  (103103, 1031, 103, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'occupied'),
  (103104, 1031, 103, 'A4', 'round', 450, 60, 84, 84, 2, 'reserved'),
  (103105, 1031, 103, 'A5', 'square', 60, 190, 84, 84, 4, 'available'),
  (103106, 1031, 103, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'occupied'),
  (103107, 1031, 103, 'A7', 'round', 320, 190, 84, 84, 2, 'reserved'),
  (103108, 1031, 103, 'A8', 'square', 450, 190, 84, 84, 4, 'available'),
  (103109, 1031, 103, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'available'),
  (103110, 1031, 103, 'A10', 'round', 190, 320, 84, 84, 2, 'reserved');
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1032, 103, 'Smoking Deck', 'smoking', 1, 640, 360, 1);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (103201, 1032, 103, 'SMK11', 'round', 60, 60, 84, 84, 2, 'reserved'),
  (103202, 1032, 103, 'SMK12', 'square', 190, 60, 84, 84, 4, 'available'),
  (103203, 1032, 103, 'SMK13', 'rectangle', 320, 60, 120, 70, 6, 'available'),
  (103204, 1032, 103, 'SMK14', 'round', 450, 60, 84, 84, 2, 'occupied'),
  (103205, 1032, 103, 'SMK15', 'square', 60, 190, 84, 84, 4, 'reserved'),
  (103206, 1032, 103, 'SMK16', 'rectangle', 190, 190, 120, 70, 6, 'available');

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (104, 1, 4, 'Ruang Tunggu Kopi', 'ruang-tunggu-kopi', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Ruang Tunggu Kopi St.', -6.1854, 106.7699, '$$', '+62812000104', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80', true, 20000, 68, 4.3, 198);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1041, 104, 'Main Room', 'indoor', 1, 640, 620, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (104101, 1041, 104, 'A1', 'round', 60, 60, 84, 84, 2, 'reserved'),
  (104102, 1041, 104, 'A2', 'square', 190, 60, 84, 84, 4, 'available'),
  (104103, 1041, 104, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'occupied'),
  (104104, 1041, 104, 'A4', 'round', 450, 60, 84, 84, 2, 'reserved'),
  (104105, 1041, 104, 'A5', 'square', 60, 190, 84, 84, 4, 'available'),
  (104106, 1041, 104, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'available'),
  (104107, 1041, 104, 'A7', 'round', 320, 190, 84, 84, 2, 'reserved'),
  (104108, 1041, 104, 'A8', 'square', 450, 190, 84, 84, 4, 'available'),
  (104109, 1041, 104, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'available'),
  (104110, 1041, 104, 'A10', 'round', 190, 320, 84, 84, 2, 'occupied'),
  (104111, 1041, 104, 'A11', 'square', 320, 320, 84, 84, 4, 'reserved'),
  (104112, 1041, 104, 'A12', 'rectangle', 450, 320, 120, 70, 6, 'available'),
  (104113, 1041, 104, 'A13', 'round', 60, 450, 84, 84, 2, 'occupied'),
  (104114, 1041, 104, 'A14', 'square', 190, 450, 84, 84, 4, 'reserved'),
  (104115, 1041, 104, 'A15', 'rectangle', 320, 450, 120, 70, 6, 'available'),
  (104116, 1041, 104, 'A16', 'round', 450, 450, 84, 84, 2, 'available');

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (105, 1, 2, 'Selasar Senja', 'selasar-senja', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Selasar Senja St.', -6.228, 106.811, '$$$', '+62812000105', 'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=800&q=80', true, 50000, 95, 4.9, 1024);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1051, 105, 'Indoor Lounge', 'indoor', 1, 640, 490, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (105101, 1051, 105, 'A1', 'round', 60, 60, 84, 84, 2, 'reserved'),
  (105102, 1051, 105, 'A2', 'square', 190, 60, 84, 84, 4, 'available'),
  (105103, 1051, 105, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'available'),
  (105104, 1051, 105, 'A4', 'round', 450, 60, 84, 84, 2, 'reserved'),
  (105105, 1051, 105, 'A5', 'square', 60, 190, 84, 84, 4, 'available'),
  (105106, 1051, 105, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'available'),
  (105107, 1051, 105, 'A7', 'round', 320, 190, 84, 84, 2, 'occupied'),
  (105108, 1051, 105, 'A8', 'square', 450, 190, 84, 84, 4, 'reserved'),
  (105109, 1051, 105, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'available'),
  (105110, 1051, 105, 'A10', 'round', 190, 320, 84, 84, 2, 'occupied');
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1052, 105, 'Rooftop', 'outdoor', 2, 640, 490, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (105201, 1052, 105, 'OUT11', 'round', 60, 60, 84, 84, 2, 'occupied'),
  (105202, 1052, 105, 'OUT12', 'square', 190, 60, 84, 84, 4, 'reserved'),
  (105203, 1052, 105, 'OUT13', 'rectangle', 320, 60, 120, 70, 6, 'available'),
  (105204, 1052, 105, 'OUT14', 'round', 450, 60, 84, 84, 2, 'available'),
  (105205, 1052, 105, 'OUT15', 'square', 60, 190, 84, 84, 4, 'reserved'),
  (105206, 1052, 105, 'OUT16', 'rectangle', 190, 190, 120, 70, 6, 'available'),
  (105207, 1052, 105, 'OUT17', 'round', 320, 190, 84, 84, 2, 'available'),
  (105208, 1052, 105, 'OUT18', 'square', 450, 190, 84, 84, 4, 'occupied'),
  (105209, 1052, 105, 'OUT19', 'rectangle', 60, 320, 120, 70, 6, 'reserved'),
  (105210, 1052, 105, 'OUT20', 'round', 190, 320, 84, 84, 2, 'available'),
  (105211, 1052, 105, 'OUT21', 'square', 320, 320, 84, 84, 4, 'occupied'),
  (105212, 1052, 105, 'OUT22', 'rectangle', 450, 320, 120, 70, 6, 'reserved');

INSERT INTO cafes (id, merchant_user_id, district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number, cover_image_url, requires_down_payment, dp_amount, popularity_score, avg_rating, total_reviews) OVERRIDING SYSTEM VALUE VALUES
  (106, 1, 1, 'Kedai Pagi Kebayoran', 'kedai-pagi-kebayoran', 'A cozy specialty coffee spot with curated seating zones and fast Wi-Fi.', 'Jl. Kedai Pagi Kebayoran St.', -6.242, 106.801, '$', '+62812000106', 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80', false, 0, 55, 4.1, 120);
INSERT INTO floors (id, cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order) OVERRIDING SYSTEM VALUE VALUES
  (1061, 106, 'Main Room', 'indoor', 1, 640, 490, 0);
INSERT INTO tables (id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, capacity, status) OVERRIDING SYSTEM VALUE VALUES
  (106101, 1061, 106, 'A1', 'round', 60, 60, 84, 84, 2, 'reserved'),
  (106102, 1061, 106, 'A2', 'square', 190, 60, 84, 84, 4, 'available'),
  (106103, 1061, 106, 'A3', 'rectangle', 320, 60, 120, 70, 6, 'available'),
  (106104, 1061, 106, 'A4', 'round', 450, 60, 84, 84, 2, 'occupied'),
  (106105, 1061, 106, 'A5', 'square', 60, 190, 84, 84, 4, 'reserved'),
  (106106, 1061, 106, 'A6', 'rectangle', 190, 190, 120, 70, 6, 'available'),
  (106107, 1061, 106, 'A7', 'round', 320, 190, 84, 84, 2, 'occupied'),
  (106108, 1061, 106, 'A8', 'square', 450, 190, 84, 84, 4, 'reserved'),
  (106109, 1061, 106, 'A9', 'rectangle', 60, 320, 120, 70, 6, 'available');

-- Sample menu (Kopi Kina Senopati) so the cafe page has something to show out of the box.
INSERT INTO menu_items (cafe_id, name, description, price, category, is_available, sort_order) VALUES
  (101, 'Kopi Kina Signature', 'House blend over ice with a hint of citrus.', 28000, 'Coffee', true, 0),
  (101, 'Cappuccino', 'Double shot espresso, steamed milk.', 32000, 'Coffee', true, 1),
  (101, 'Matcha Latte', 'Ceremonial-grade matcha, oat milk option.', 34000, 'Non-Coffee', true, 2),
  (101, 'Butter Croissant', 'Baked fresh every morning.', 22000, 'Food', true, 3),
  (101, 'Nasi Goreng Kina', 'Wok-fried rice, egg, and chicken satay skewer.', 45000, 'Food', true, 4),
  (101, 'Seasonal Fruit Tart', 'Rotating fruit selection, limited daily stock.', 38000, 'Dessert', false, 5)
ON CONFLICT DO NOTHING;

-- Demo Merchant/Admin/Cashier (user ids 1/4/2) are all scoped to cafe 101 —
-- managed via the super_admin's /admin page. One user id -> one cafe.
INSERT INTO cafe_staff (cafe_id, user_id) VALUES
  (101, 1),
  (101, 2),
  (101, 4)
ON CONFLICT (user_id) DO UPDATE SET cafe_id = excluded.cafe_id;

SELECT setval(pg_get_serial_sequence('cafes','id'), (SELECT MAX(id) FROM cafes));
SELECT setval(pg_get_serial_sequence('floors','id'), (SELECT MAX(id) FROM floors));
SELECT setval(pg_get_serial_sequence('tables','id'), (SELECT MAX(id) FROM tables));
SELECT setval(pg_get_serial_sequence('menu_items','id'), GREATEST((SELECT MAX(id) FROM menu_items), 1));
SELECT setval(pg_get_serial_sequence('cafe_staff','id'), GREATEST((SELECT MAX(id) FROM cafe_staff), 1));
COMMIT;
