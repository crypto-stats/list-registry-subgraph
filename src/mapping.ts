import { Bytes, store } from "@graphprotocol/graph-ts"
import { CollectionCreated, CollectionArchived, ElementAdded, ElementUpdated } from "../generated/Registry/Registry"
import { Collection, Adapter, CollectionAdapter } from "../generated/schema"

function decodeCID(cid: Bytes): string {
  return Bytes.fromHexString('1220' + cid.toHexString().slice(2)).toBase58()
}

function enableList(listId: Bytes): void {
  let collection = Collection.load(listId.toString())
  if (collection.archived) {
    collection.archived = false
    collection.save()
  }
}

export function handleCollectionCreated(event: CollectionCreated): void {
  let collection = new Collection(event.params.collection.toString())
  collection.proxy = event.params.proxy
  collection.archived = false

  collection.save()
}

export function handleCollectionArchived(event: CollectionArchived): void {
  let collection = new Collection(event.params.collection.toString())
  collection.archived = true

  collection.save()
}

export function handleElementAdded(event: ElementAdded): void {
  let adapterCid = decodeCID(event.params.newElement)

  let adapter = Adapter.load(adapterCid)
  if (!adapter) {
    adapter = new Adapter(adapterCid)
  }

  let collectionAdapter = new CollectionAdapter(event.params.collection.toString() + '-' + adapterCid)
  collectionAdapter.collection = event.params.collection.toString()
  collectionAdapter.adapter = adapterCid
  collectionAdapter.previousVersions = []

  enableList(event.params.collection)

  adapter.save()
  collectionAdapter.save()
}

export function handleElementUpdated(event: ElementUpdated): void {
  let oldCid = decodeCID(event.params.oldElement)
  let newCid = decodeCID(event.params.newElement)

  let newAdapter = Adapter.load(newCid)
  if (!newAdapter) {
    newAdapter = new Adapter(newCid)
  }

  let oldListAdapter = CollectionAdapter.load(event.params.collection.toString() + '-' + oldCid)
  let previousVersions = oldListAdapter.previousVersions
  previousVersions.push(oldCid)

  let collectionAdapter = new CollectionAdapter(event.params.collection.toString() + '-' + newCid)
  collectionAdapter.collection = event.params.collection.toString()
  collectionAdapter.adapter = newCid
  collectionAdapter.previousVersions = previousVersions

  enableList(event.params.collection)

  newAdapter.save()
  collectionAdapter.save()

  store.remove('Adapter', oldCid)
  store.remove('CollectionAdapter', event.params.collection.toString() + '-' + oldCid)
}
