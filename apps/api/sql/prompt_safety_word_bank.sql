INSERT INTO system_config (key, value)
VALUES (
  'prompt_safety_word_bank',
  '{
    "sexual": ["裸露", "色情", "成人视频", "约炮", "porn", "nude", "nsfw", "sex"],
    "violence": ["血腥", "虐杀", "爆头", "斩首", "恐怖袭击", "kill", "gore", "behead"],
    "sensitive": ["恐怖组织", "极端主义", "毒品交易", "仇恨言论", "hate speech", "bomb tutorial"]
  }'::jsonb
)
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value;
