// import { BigInt } from "@graphprotocol/graph-ts"
import { ListCreated } from "../generated/Registry/Registry"
import { List } from "../generated/schema"

export function handleListCreated(event: ListCreated): void {
  let list = new List(event.params.list.toString())
  list.proxy = event.params.proxy

  list.save()
}
