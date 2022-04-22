import type { Collection } from './collection'
import type { Readable } from 'streamx'
import { FetchOpts } from './fetch'

export interface UploadFileOpts {
  onUploadProgress?: (progress: any) => void
}
export interface RangeOpts {
  range?: {
    from: number
    to: number
  }
}

export type FileMetadata = any

export type FileBody = string | Readable | Uint8Array | Buffer | ReadableStream | any

/**
 * File system for a collection.
 */
export class Files {
  /**
     * File system for a collection.
     *
     * @constructor
     * @param {Collection} collection - Collection
     */
  constructor (public collection: Collection) {
    this.collection = collection
  }

  /**
     * Create a new file
     * @param {FileBody|Buffer} stream - File content as stream or buffer
     * @param {object} [metadata] - File record metadata (see file record schema)
     * @param {object} [opts] - Options.
     *  - onUploadProgress: Callback to invoke with upload progress information
     * @returns {Record} - The created file record
     */
  async createFile (stream: FileBody, metadata?: any, opts: UploadFileOpts = {}) {
    const requestType = 'stream'
    const params: Record<string, any> = {}
    if (metadata) { params.metadata = JSON.stringify(metadata) }
    return await this.collection.fetch('/file', {
      method: 'POST',
      body: stream,
      params,
      requestType
      // onUploadProgress: opts.onUploadProgress
    })
  }

  /**
     * Update a file
     * @param {string} id - The file record id
     * @param {FileBody|Buffer} stream - File content as stream or buffer
     * @param {object} [metadata] - File record metadata (see file record schema)
     * @param {object} [opts] - Options.
     *  - onUploadProgress: Callback to invoke with upload progress information
     * @returns {Record} - The created file record
     */
  async updateFile (id: string, stream: FileBody, metadata: any, opts: UploadFileOpts = {}) {
    const requestType = 'stream'
    const params: Record<string, any> = {}
    if (metadata) { params.metadata = JSON.stringify(metadata) }
    return await this.collection.fetch('/file/' + id, {
      method: 'PUT',
      body: stream,
      params,
      requestType
      // onUploadProgress: opts.onUploadProgress
    })
  }

  /**
     * Read a file into a buffer.
     *
     * @async
     * @param {string} id - A file ID
     * @param {object} [opts] - Options. TODO: document.
     * @throws Will throw if the path is not found.
     * @return {Promise<ArrayBuffer|Buffer>} The file content. A Buffer object in Node.js, a ArrayBuffer object in the browser.
     */
  async readFile (id: string, opts: FetchOpts & RangeOpts = {}): Promise<ArrayBuffer|Buffer> {
    opts.responseType = opts.responseType || 'stream'
    if (opts.headers == null) { opts.headers = {} }
    if (opts.range != null) {
      opts.headers.Range = `bytes=${opts.range.from || 0}-${opts.range.to || ''}`
    }
    return await this.collection.fetch('/file/' + id, opts)
  }

  /**
     * Returns the HTTP url for a file.
     * @async
     * @param {string} id - A file ID
     * @return {Promise<string>} The file URL
     */
  getURL (id: string): string {
    return `${this.collection.endpoint}/file/${id}`
  }

  /**
     * Get the metadata for a file
     *
     * @async
     * @param {string} id - A file ID
     * @throws Will throw if the path is not found.
     * @return {Promise<object>} The file record value (metadata)
     */
  async getFileMetadata (id: string, opts: FetchOpts = {}): Promise<FileMetadata> {
    return await this.collection.fetch(`/file/${id}?meta=1`, opts)
  }
}
