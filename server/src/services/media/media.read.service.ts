import { MediaRepository } from '../../repositories/media.repository';
import { MediaFormatter } from '../../shared/formatters/media.formatter';

export class MediaReadService {
    constructor(private mediaRepository: MediaRepository) {}

    async getMedia(id: string, treeId: string) {
        const media = await this.mediaRepository.findById(id, treeId);
        if (!media) return null;
        return MediaFormatter.formatMediaForClient(media);
    }

    async getMediaList(treeId: string) {
        const mediaList = await this.mediaRepository.findAll(treeId);
        return mediaList.map((m: any) => MediaFormatter.formatMediaForClient(m));
    }
}
