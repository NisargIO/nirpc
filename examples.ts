import type { NirpcReturn } from "./index";

type Remote = {
  hello: (payload: { name: string }) => Promise<string>;
};

const rpc = {} as NirpcReturn<Remote>;

rpc
  .method("hello")
  .params({ name: "Cursor" })
  .timeout(1_000)
  .ackTimeout(500)
  .retry(3)
  .execute()
  .then(console.log);
