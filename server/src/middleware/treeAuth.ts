import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Middleware to validate tree existence and (eventually) user permissions.
 * Expects ':tree' parameter in the URL (tree name).
 */
export const treeAuth = (prisma: PrismaClient) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const treeName = String(req.params.tree || req.params.treeName || '');
            const treeIdFromBody = req.body?.treeId || req.query.treeId;
            // NOTE: Only accept authenticated context (JWT); no header/body fallbacks.
            const userId = (req as any).user?.id;
            
            let tree = null;
            if (treeName) {
                // Try name first
                tree = await prisma.tree.findUnique({ where: { name: treeName as string } });
                
                // If not found and looks like UUID, try ID
                if (!tree && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(treeName)) {
                    tree = await prisma.tree.findUnique({ where: { id: treeName as string } });
                }
            } else if (treeIdFromBody) {
                tree = await prisma.tree.findUnique({ where: { id: treeIdFromBody as string } });
            }

            if (!tree) {
                if (treeName || treeIdFromBody) {
                    return res.status(404).json({ success: false, message: 'Tree not found' });
                }
                return next(); // No tree specified, continue (e.g. general routes)
            }

            // Resolve the authenticated user. Admins are NOT auto-granted tree access:
            // they need an explicit TreePermission (or the tree must be public) like anyone else.
            const user = (req as any).user || (userId ? await prisma.user.findUnique({ where: { id: userId as string } }) : null);

            // 1. Public Tree Check (Read-only)
            if (tree.isPublic && req.method === 'GET') {
                (req as any).tree = tree;
                (req as any).permission = 'VIEWER';
                return next();
            }

            // 3. Specific Permission Check
            if (userId) {
                const permission = await prisma.treePermission.findUnique({
                    where: { treeId_userId: { treeId: tree.id, userId: userId as string } }
                });

                if (permission) {
                    console.log(`[treeAuth] Permission found: ${permission.level} for user ${userId}`);
                    // Check if write access is needed
                    const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
                    const hasWriteAccess = ['OWNER', 'EDITOR'].includes(permission.level);

                    if (isWriteRequest && !hasWriteAccess) {
                        console.warn(`[treeAuth] Insufficient write permissions: Request ${req.method}, Perm ${permission.level}`);
                        return res.status(403).json({ success: false, message: 'Insufficient permissions for this operation' });
                    }

                    (req as any).tree = tree;
                    (req as any).permission = permission.level;
                    return next();
                } else {
                    console.log(`[treeAuth] No specific permission entry for user ${userId} on tree ${tree.id}`);
                }
            }

            console.warn(`[treeAuth] Access denied for user ${userId} to tree ${tree.id} (${tree.name}). Method: ${req.method}, UserRole: ${user?.globalRole}`);
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied to this tree',
                code: 'TREE_ACCESS_DENIED'
                
            });
        } catch (error: any) {
            console.error('[treeAuth]: Middleware error', error);
            if (error.stack) console.error(error.stack);
            res.status(500).json({ success: false, message: 'Internal server error during tree validation' });
        }
    };
};
