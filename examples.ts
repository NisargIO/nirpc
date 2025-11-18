const rpc = {} as any;
const params = {} as any;

rpc
  .method("hello")
  .params(params)
  .timeout(1000)
  .ackTimeout(1000)
  .retry(3)
  .execute();
