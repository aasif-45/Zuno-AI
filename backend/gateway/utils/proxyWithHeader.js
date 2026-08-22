import proxy from "express-http-proxy";

export const ProxtWithHeader = (serviceUrl) => {
  return proxy(serviceUrl, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        const userId = srcReq.user.userId || srcReq.user._id || srcReq.user.id;
        if (userId) {
          proxyReqOpts.headers["x-user-id"] = userId.toString();
        }
      }
      return proxyReqOpts;
    },
  });
};
