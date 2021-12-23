import { Bytes, store, ethereum, ipfs } from "@graphprotocol/graph-ts"
import { CollectionCreated, CollectionArchived, ElementAdded, ElementUpdated, ElementRemoved } from "../generated/Registry/Registry"
import { Collection, Adapter, CollectionAdapter, Signer } from "../generated/schema"

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
    adapter.signer = signer ? Bytes.fromHexString(signer).toHex() : null
  }
  return adapter
}

function createCollectionAdapter(collection: string, adapter: string, event: ethereum.Event): CollectionAdapter {
  let collectionAdapter = new CollectionAdapter(collection.toString() + '-' + adapter)
  collectionAdapter.collection = collection.toString()
  collectionAdapter.adapter = adapter
  collectionAdapter.previousVersions = []
  collectionAdapter.verificationTime = event.block.timestamp.toI32()
  collectionAdapter.verificationBlock = event.block.number.toI32()

  return collectionAdapter
}

function getSigner(signerAddress: string): Signer {
  let signer = Signer.load(signerAddress)
  if (!signer) {
    signer = new Signer(signerAddress)
    signer.activeVerifiedAdapters = 0
    signer.totalVerifiedAdapters = 0
  }

  return signer!
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
    adapter.rootAdapter = adapterCid // self-referencial
  }

  if (adapter.signer) {
    let signer = getSigner(adapter.signer)
    signer.activeVerifiedAdapters += 1
    signer.totalVerifiedAdapters += 1
    signer.save()
  }

  let collectionAdapter = createCollectionAdapter(event.params.collection.toString(), adapterCid, event)

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

  let signer: Signer
  if (newAdapter.signer) {
    signer = getSigner(newAdapter.signer)
    signer.activeVerifiedAdapters += 1
    signer.totalVerifiedAdapters += 1
  }

  let oldAdapter = Adapter.load(oldCid)
  if (!!oldAdapter && !!oldAdapter.signer) {
    if (!signer || signer.id !== oldAdapter.signer) {
      let oldSigner = getSigner(oldAdapter.signer)
      oldSigner.activeVerifiedAdapters -= 1
      oldSigner.save()
    } else {
      signer.totalVerifiedAdapters -= 1
    }
  }

  newAdapter.rootAdapter = oldAdapter != null ? oldAdapter.rootAdapter : newCid

  let oldListAdapter = CollectionAdapter.load(event.params.collection.toString() + '-' + oldCid)
  let previousVersions: string[] = oldListAdapter ? oldListAdapter.previousVersions : []
  previousVersions.push(oldCid)

  let collectionAdapter = createCollectionAdapter(event.params.collection.toString(), newCid, event)
  collectionAdapter.previousVersions = previousVersions

  enableList(event.params.collection)

  newAdapter.save()
  collectionAdapter.save()
  if (signer) {
    signer.save()
  }

  store.remove('CollectionAdapter', event.params.collection.toString() + '-' + oldCid)
}

export function handleElementRemoved(event: ElementRemoved): void {
  let oldCid = decodeCID(event.params.oldElement)

  store.remove('CollectionAdapter', event.params.collection.toString() + '-' + oldCid)
}
