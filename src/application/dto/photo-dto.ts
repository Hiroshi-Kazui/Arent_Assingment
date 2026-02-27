/**
 * Photo DTO
 * Issue に紐づく写真の情報
 */
export interface PhotoDto {
  photoId: string;
  blobKey: string;
  photoPhase: 'BEFORE' | 'AFTER';
  uploadedAt: Date;
}
