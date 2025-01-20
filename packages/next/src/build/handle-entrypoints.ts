import type { CustomRoutes } from '../lib/load-custom-routes'
import type { TurbopackManifestLoader } from '../shared/lib/turbopack/manifest-loader'
import type {
  Entrypoints,
  PageRoute,
  AppRoute,
  RawEntrypoints,
} from './swc/types'
import { getEntryKey } from '../shared/lib/turbopack/entry-key'

export async function handleEntrypoints(
  entrypointsOp: RawEntrypoints,
  manifestLoader: TurbopackManifestLoader,
  productionRewrites: CustomRoutes['rewrites'] | undefined
): Promise<void> {
  const { middleware, instrumentation } = entrypointsOp

  const entrypoints = {
    global: {
      app: entrypointsOp.pagesAppEndpoint,
      document: entrypointsOp.pagesDocumentEndpoint,
      error: entrypointsOp.pagesErrorEndpoint,
      instrumentation: entrypointsOp.instrumentation,
    },
  } as Entrypoints

  if (instrumentation) {
    await manifestLoader.loadMiddlewareManifest(
      'instrumentation',
      'instrumentation'
    )
    await manifestLoader.writeManifests({
      devRewrites: undefined,
      productionRewrites,
      entrypoints,
    })
  }

  if (middleware) {
    await manifestLoader.loadMiddlewareManifest('middleware', 'middleware')
  }
}

export async function handlePagesErrorRoute({
  entrypoints,
  manifestLoader,
  productionRewrites,
}: {
  entrypoints: Entrypoints
  manifestLoader: TurbopackManifestLoader
  productionRewrites: CustomRoutes['rewrites'] | undefined
}) {
  await manifestLoader.loadBuildManifest('_app')
  await manifestLoader.loadPagesManifest('_app')
  await manifestLoader.loadFontManifest('_app')

  await manifestLoader.loadPagesManifest('_document')

  await manifestLoader.loadBuildManifest('_error')
  await manifestLoader.loadPagesManifest('_error')
  await manifestLoader.loadFontManifest('_error')

  await manifestLoader.writeManifests({
    devRewrites: undefined,
    productionRewrites,
    entrypoints,
  })
}

export async function handleRouteType({
  page,
  route,
  manifestLoader,
}: {
  page: string
  route: PageRoute | AppRoute
  manifestLoader: TurbopackManifestLoader
}) {
  const shouldCreateWebpackStats = process.env.TURBOPACK_STATS != null

  switch (route.type) {
    case 'page': {
      const serverKey = getEntryKey('pages', 'server', page)

      await manifestLoader.loadBuildManifest('_app')
      await manifestLoader.loadPagesManifest('_app')
      await manifestLoader.loadPagesManifest('_document')

      const type = await route.htmlEndpoint.runtime()

      await manifestLoader.loadBuildManifest(page)
      await manifestLoader.loadPagesManifest(page)
      if (type === 'edge') {
        await manifestLoader.loadMiddlewareManifest(page, 'pages')
      } else {
        manifestLoader.deleteMiddlewareManifest(serverKey)
      }
      await manifestLoader.loadFontManifest('/_app', 'pages')
      await manifestLoader.loadFontManifest(page, 'pages')

      if (shouldCreateWebpackStats) {
        await manifestLoader.loadWebpackStats(page, 'pages')
      }

      break
    }
    case 'page-api': {
      const key = getEntryKey('pages', 'server', page)

      const type = await route.endpoint.runtime()

      await manifestLoader.loadPagesManifest(page)
      if (type === 'edge') {
        await manifestLoader.loadMiddlewareManifest(page, 'pages')
      } else {
        manifestLoader.deleteMiddlewareManifest(key)
      }

      break
    }
    case 'app-page': {
      const key = getEntryKey('app', 'server', page)
      const type = await route.htmlEndpoint.runtime()

      if (type === 'edge') {
        await manifestLoader.loadMiddlewareManifest(page, 'app')
      } else {
        manifestLoader.deleteMiddlewareManifest(key)
      }

      await manifestLoader.loadAppBuildManifest(page)
      await manifestLoader.loadBuildManifest(page, 'app')
      await manifestLoader.loadAppPathsManifest(page)
      await manifestLoader.loadActionManifest(page)
      await manifestLoader.loadFontManifest(page, 'app')

      if (shouldCreateWebpackStats) {
        await manifestLoader.loadWebpackStats(page, 'app')
      }

      break
    }
    case 'app-route': {
      const key = getEntryKey('app', 'server', page)
      const type = await route.endpoint.runtime()

      await manifestLoader.loadAppPathsManifest(page)

      if (type === 'edge') {
        await manifestLoader.loadMiddlewareManifest(page, 'app')
      } else {
        manifestLoader.deleteMiddlewareManifest(key)
      }

      break
    }
    default: {
      throw new Error(`unknown route type ${(route as any).type} for ${page}`)
    }
  }
}
