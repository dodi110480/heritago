<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\Date\GregorianDate;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\CalendarService;
use Fisharebest\Webtrees\Services\TreeService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function date;
use function json_encode;
use function response;

use const JSON_THROW_ON_ERROR;

class ApiCalendarHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly CalendarService $calendar_service,
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_name = $request->getAttribute('tree');
        $tree = $this->tree_service->all()->get($tree_name);

        if (!$tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Tree not found',
            ], 404);
        }

        $params = $request->getQueryParams();
        $day = (int) ($params['day'] ?? date('j'));
        $month = (int) ($params['month'] ?? date('n'));
        $year = (int) ($params['year'] ?? date('Y'));

        // Calculate Julian Day for the requested date (noon)
        $jd = (new GregorianDate([(string) $year, (string) $month, (string) $day]))->minimumJulianDay();

        $events = $this->calendar_service->getAnniversaryEvents($jd, '', $tree);

        $results = [];
        foreach ($events as $fact) {
            $record = $fact->record();
            $results[] = [
                'id' => $record->xref(),
                'type' => $fact->label(),
                'date' => $fact->date()->display(),
                'name' => $record->fullName(),
                'years' => $fact->anniv, // Years since event
            ];
        }

        return response(json_encode([
            'success' => true,
            'date' => "$day.$month.$year",
            'events' => $results,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
