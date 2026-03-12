import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export class AuthService {
    private readonly SALT_ROUNDS = 12;

    constructor(private prisma: PrismaClient) {}

    async validateUser(username: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { username } });

        if (user && user.password && await bcrypt.compare(password, user.password)) {
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                globalRole: user.globalRole,
                isAdmin: user.globalRole === 'ADMIN'
            };
        }
        return null;
    }

    async registerUser(data: { username: string, email: string, password: string }) {
        const { username, email, password } = data;

        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ username }, { email }] }
        });

        if (existingUser) {
            throw new Error('Benutzername oder Email bereits vergeben.');
        }

        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                globalRole: 'USER'
            }
        });

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: false
        };
    }

    async getUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                email: true,
                globalRole: true,
                createdAt: true,
                _count: {
                    select: { permissions: { where: { level: 'OWNER' } } }
                }
            }
        });
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({ where: { id } });
    }

    async updateUserRole(id: string, role: string) {
        return this.prisma.user.update({
            where: { id },
            data: { globalRole: role as any }
        });
    }
}
