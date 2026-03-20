// server/src/services/place/place.read.service.ts
import { PlaceRepository } from '../../repositories/place.repository';
import { PlaceFormatter } from '../../shared/formatters/place.formatter';

export class PlaceReadService {
    constructor(private placeRepository: PlaceRepository) {}

    async getPlace(id: string, treeId: string) {
        const place = await this.placeRepository.findById(id, treeId);
        if (!place) return null;
        return PlaceFormatter.formatPlaceForClient(place);
    }

    async getPlaces(treeId: string) {
        const places = await this.placeRepository.findAll(treeId);
        return places.map((p: any) => PlaceFormatter.formatPlaceForClient(p));
    }

    async searchPlaces(query: string, treeId: string) {
        return this.placeRepository.search(query, treeId);
    }
}
