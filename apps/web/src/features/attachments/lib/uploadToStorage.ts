/** Uploads a file directly to the presigned storage URL (MinIO/S3/R2),
 * bypassing the API entirely — this is the "client uploads directly to
 * storage" step of the presigned-upload pipeline. Deliberately a plain
 * `fetch`, not routed through `apiClient`'s `rawFetch`: that helper always
 * attaches the app's `Authorization` header and `credentials: 'include'`,
 * which this request must not send to a different-origin storage endpoint
 * (the presigned URL carries its own auth via query string). */
export async function uploadToStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Upload to storage failed (${response.status})`)
  }
}
