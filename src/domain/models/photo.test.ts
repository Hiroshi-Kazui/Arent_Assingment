import { describe, it, expect } from 'vitest';
import { Photo, PhotoId, PhotoPhase } from './photo';
import { IssueId } from './issue';

describe('Photo ドメインモデル', () => {
  describe('Photo.create()', () => {
    // DOM-PHT-001: Photo.create() で Before/After/Rejection の3フェーズが生成できる
    it('PhotoPhase.Before で Photo が生成され phase が一致する', () => {
      // Arrange
      const photoId = PhotoId.create('photo-001');
      const issueId = IssueId.create('issue-001');

      // Act
      const photo = Photo.create(
        photoId,
        issueId,
        'projects/p/issues/i/photos/x.jpg',
        PhotoPhase.Before,
        null
      );

      // Assert
      expect(photo.phase).toBe(PhotoPhase.Before);
    });

    it('PhotoPhase.After で Photo が生成され phase が一致する', () => {
      // Arrange
      const photoId = PhotoId.create('photo-002');
      const issueId = IssueId.create('issue-001');

      // Act
      const photo = Photo.create(
        photoId,
        issueId,
        'projects/p/issues/i/photos/y.jpg',
        PhotoPhase.After,
        null
      );

      // Assert
      expect(photo.phase).toBe(PhotoPhase.After);
    });

    it('PhotoPhase.Rejection で Photo が生成され phase が一致する', () => {
      // Arrange
      const photoId = PhotoId.create('photo-003');
      const issueId = IssueId.create('issue-001');

      // Act
      const photo = Photo.create(
        photoId,
        issueId,
        'projects/p/issues/i/photos/z.jpg',
        PhotoPhase.Rejection,
        null
      );

      // Assert
      expect(photo.phase).toBe(PhotoPhase.Rejection);
    });

    // DOM-PHT-002: Photo.create() で blobKey 空文字を渡すと Error がスローされる
    it('blobKey に空文字を渡すと Error がスローされる', () => {
      // Arrange
      const photoId = PhotoId.create('photo-004');
      const issueId = IssueId.create('issue-001');

      // Act & Assert
      expect(() =>
        Photo.create(photoId, issueId, '', PhotoPhase.Before, null)
      ).toThrow('Photo blobKey must not be empty');
    });
  });
});
