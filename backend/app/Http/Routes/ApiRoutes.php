<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\Routes;

use Aura\Router\Map;
use Fisharebest\Webtrees\Http\RequestHandlers\Api as Api;
use Fisharebest\Webtrees\Http\RequestHandlers\Api\TreeDataHandler;

/**
 * Routing table for API requests
 */
class ApiRoutes
{
    /**
     * @param Map $router
     *
     * @return void
     */
    public function load(Map $router): void
    {
        $router->route(TreeDataHandler::class, '/api/tree/{tree}', TreeDataHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiLoginHandler::class, '/api/auth/login', Api\ApiLoginHandler::class)
            ->allows(['POST', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\TreeListHandler::class, '/api/trees', Api\TreeListHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiCreateTreeHandler::class, '/api/tree/create', Api\ApiCreateTreeHandler::class)
            ->allows(['POST', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiSearchHandler::class, '/api/tree/{tree}/search', Api\ApiSearchHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiCalendarHandler::class, '/api/tree/{tree}/calendar', Api\ApiCalendarHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiMapHandler::class, '/api/tree/{tree}/map', Api\ApiMapHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiMediaHandler::class, '/api/tree/{tree}/media', Api\ApiMediaHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiStatisticsHandler::class, '/api/tree/{tree}/statistics', Api\ApiStatisticsHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiTimelineHandler::class, '/api/tree/{tree}/timeline/{xref}', Api\ApiTimelineHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiPersonHandler::class, '/api/tree/{tree}/person', Api\ApiPersonHandler::class)
            ->allows(['POST', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiFamilyHandler::class, '/api/tree/{tree}/family', Api\ApiFamilyHandler::class)
            ->allows(['POST', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiPlaceSearchHandler::class, '/api/tree/{tree}/places/search', Api\ApiPlaceSearchHandler::class)
            ->allows(['GET', 'OPTIONS'])
            ->accepts(['application/json']);

        $router->route(Api\ApiPlaceHandler::class, '/api/tree/{tree}/place', Api\ApiPlaceHandler::class)
            ->allows(['GET', 'POST', 'OPTIONS'])
            ->accepts(['application/json']);
    }
}
