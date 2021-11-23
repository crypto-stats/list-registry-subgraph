import { Bytes } from "@graphprotocol/graph-ts"
import { ListCreated, ElementAdded } from "../generated/Registry/Registry"
import { List, Adapter, ListAdapter } from "../generated/schema"

function decodeCID(cid: Bytes): string {
  return Bytes.fromHexString('1220' + cid.toHexString().slice(2)).toBase58()
}

export function handleListCreated(event: ListCreated): void {
  let list = new List(event.params.list.toString())
  list.proxy = event.params.proxy

  list.save()
}

export function handleElementAdded(event: ElementAdded): void {
  let adapterCid = decodeCID(event.params.newElement)

  let adapter = Adapter.load(adapterCid)
  if (!adapter) {
    adapter = new Adapter(adapterCid)
  }

  let listAdapter = new ListAdapter(event.params.list.toString() + '-' + adapterCid)
  listAdapter.list = event.params.list.toString()
  listAdapter.adapter = adapterCid

  adapter.save()
  listAdapter.save()
}
