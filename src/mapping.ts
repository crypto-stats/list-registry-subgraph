import { Bytes, store } from "@graphprotocol/graph-ts"
import { ListCreated, ListArchived, ElementAdded, ElementUpdated } from "../generated/Registry/Registry"
import { List, Adapter, ListAdapter } from "../generated/schema"

function decodeCID(cid: Bytes): string {
  return Bytes.fromHexString('1220' + cid.toHexString().slice(2)).toBase58()
}

function enableList(listId: Bytes): void {
  let list = List.load(listId.toString())
  if (list.archived) {
    list.archived = false
    list.save()
  }
}

export function handleListCreated(event: ListCreated): void {
  let list = new List(event.params.list.toString())
  list.proxy = event.params.proxy
  list.archived = false

  list.save()
}

export function handleListArchived(event: ListArchived): void {
  let list = new List(event.params.list.toString())
  list.archived = true

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
  listAdapter.previousVersions = []

  enableList(event.params.list)

  adapter.save()
  listAdapter.save()
}

export function handleElementUpdated(event: ElementUpdated): void {
  let oldCid = decodeCID(event.params.oldElement)
  let newCid = decodeCID(event.params.newElement)

  let newAdapter = Adapter.load(newCid)
  if (!newAdapter) {
    newAdapter = new Adapter(newCid)
  }

  let oldListAdapter = ListAdapter.load(event.params.list.toString() + '-' + oldCid)
  let previousVersions = oldListAdapter.previousVersions
  previousVersions.push(oldCid)

  let listAdapter = new ListAdapter(event.params.list.toString() + '-' + newCid)
  listAdapter.list = event.params.list.toString()
  listAdapter.adapter = newCid
  listAdapter.previousVersions = previousVersions

  enableList(event.params.list)

  newAdapter.save()
  listAdapter.save()

  store.remove('Adapter', oldCid)
  store.remove('ListAdapter', event.params.list.toString() + '-' + oldCid)
}
