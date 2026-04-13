// E2E test environment — raise rate limits to avoid 429s in multi-upload tests
process.env.PHOTO_UPLOAD_LIMIT_PER_MIN = "999";
process.env.PHOTO_UPLOAD_LIMIT_PER_HOUR = "999";
process.env.THROTTLE_LIMIT = "9999";
process.env.THROTTLE_AUTH_LIMIT = "9999";
