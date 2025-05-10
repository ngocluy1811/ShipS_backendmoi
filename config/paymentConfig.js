module.exports = {
    momo: {
      partnerCode: 'MOMO', // Lấy từ đoạn mã mẫu
      accessKey: 'F8BBA842ECF85', // Lấy từ đoạn mã mẫu
      secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz', // Lấy từ đoạn mã mẫu
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
      returnUrl: 'https://232f-14-191-68-176.ngrok-free.app/payment-success', // FE sẽ nhận callback này
      notifyUrl: 'https://232f-14-191-68-176.ngrok-free.app/api/payments/momo/callback', // BE sẽ nhận callback này
      paymentCode: 'T8Qii53fAXyUftPV3m9ysyRhEanUs9KlOPfHgpMR0ON50U10Bh+vZdpJU7VY4z+Z2y77fJHkoDc69scwwzLuW5MzeUKTwPo3ZMaB29imm6YulqnWfTkgzqRaion+EuD7FN9wZ4aXE1+mRt0gHsU193y+yxtRgpmY7SDMU9hCKoQtYyHsfFR5FUAOAKMdw2fzQqpToei3rnaYvZuYaxolprm9+/+WIETnPUDlxCYOiw7vPeaaYQQH0BF0TxyU3zu36ODx980rJvPAgtJzH1gUrlxcSS1HQeQ9ZaVM1eOK/jl8KJm6ijOwErHGbgf/hVymUQG65rHU2MWz9U8QUjvDWA==' // Lấy từ đoạn mã mẫu
    },
    zalopay: {
      appId: 'YOUR_ACTUAL_ZALOPAY_APP_ID',
      key1: 'YOUR_ACTUAL_ZALOPAY_KEY1',
      key2: 'YOUR_ACTUAL_ZALOPAY_KEY2',
      endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
      callbackUrl: 'https://abc123.ngrok.io/api/payments/zalopay/callback'
    }
  };