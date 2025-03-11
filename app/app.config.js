export default {
  expo: {
    assetBundlePatterns: [
      "**/*"
    ],
    extra: {
      NGROK_URL: process.env.NGROK_URL,
    },
  },
};