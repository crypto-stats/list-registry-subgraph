import { Bytes, store, ipfs } from "@graphprotocol/graph-ts"
import { CollectionCreated, CollectionArchived, ElementAdded, ElementUpdated, ElementRemoved } from "../generated/Registry/Registry"
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

function getDefinedProperty(code: string, property: string): string | null {
  let searchString = "exports." + property +" = '"
  let match = code.indexOf(searchString)
  if (match != -1) {
    let start = match + searchString.length
    let end = code.indexOf("'", start + 1)

    if (end != -1) {
      return code.substring(start, end)
    }
  }
  return null
}

function createAdapter(cid: string): Adapter {
  let adapter = new Adapter(cid)

  let data = ipfs.cat(cid)

  if (data) {
    let code = data.toString()
    adapter.code = code
    adapter.version = getDefinedProperty(code, 'version')
    let signer = getDefinedProperty(code, 'signer')
    adapter.signer = signer ? Bytes.fromHexString(signer) as Bytes : null
  }
  return adapter
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
    adapter = createAdapter(adapterCid)
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
    newAdapter = createAdapter(newCid)
  }

  let oldListAdapter = CollectionAdapter.load(event.params.collection.toString() + '-' + oldCid)
  let previousVersions: string[] = oldListAdapter ? oldListAdapter.previousVersions : []
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

export function handleElementRemoved(event: ElementRemoved): void {
  let oldCid = decodeCID(event.params.oldElement)

  store.remove('Adapter', oldCid)
  store.remove('CollectionAdapter', event.params.collection.toString() + '-' + oldCid)
}
