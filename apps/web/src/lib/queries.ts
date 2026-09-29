'use client';

import {
  hasPermission,
  type AuthUser,
  type DocumentDownload,
  type DocumentDto,
  type DownloadDisposition,
  type ManagedUserDto,
  type Paginated,
  type PassportDto,
  type PassportListQuery,
  type PassportRequest,
  type Permission,
  type Role,
  type UpdateDocumentInput,
} from '@bpp/shared/schemas';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, parseResponse } from './api-client';
import { useIsClient } from './hooks';

/** Passport list parameters as accepted by GET /api/passports (all optional). */
export type PassportListParams = Partial<Omit<PassportListQuery, 'q'>> & { q?: string };

const queryKeys = {
  session: ['session'] as const,
  passports: (params: PassportListParams) => ['passports', params] as const,
  passport: (id: string) => ['passport', id] as const,
  documents: (filter: { passportId?: string; page: number; limit: number }) => ['documents', filter] as const,
  documentLink: (docId: string, disposition: DownloadDisposition) =>
    ['document-link', docId, disposition] as const,
  users: (params: UserListParams) => ['users', params] as const,
};

export interface UserListParams {
  page?: number;
  limit?: number;
  q?: string;
  role?: Role;
}

function toSearchParams(params: object): URLSearchParams {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search;
}

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () =>
      (await parseResponse<{ user: AuthUser }>(await fetch('/api/auth/session', { cache: 'no-store' }))).user,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether the signed-in user's role grants `permission` (shared PERMISSIONS table). Role-specific
 * UI is revealed only after hydration: Suspense boundaries hydrate after the session query may
 * already have resolved, and the server HTML never contains role-specific controls.
 * The services enforce the same permissions on every request.
 */
export function useCan(permission: Permission): boolean {
  const isClient = useIsClient();
  const role = useSession().data?.role;
  return isClient && hasPermission(role, permission);
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => api.get<Paginated<ManagedUserDto>>(`/users?${toSearchParams(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch<ManagedUserDto>(`/users/${userId}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function usePassports(params: PassportListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.passports(params),
    queryFn: () => api.get<Paginated<PassportDto>>(`/passports?${toSearchParams(params)}`),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function usePassport(id: string) {
  return useQuery({
    queryKey: queryKeys.passport(id),
    queryFn: () => api.get<PassportDto>(`/passports/${id}`),
  });
}

export function useDocuments(filter: { passportId?: string; page?: number; limit?: number } = {}) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const params = toSearchParams({ page, limit, passportId: filter.passportId });

  return useQuery({
    queryKey: queryKeys.documents({ passportId: filter.passportId, page, limit }),
    queryFn: () => api.get<Paginated<DocumentDto>>(`/documents?${params}`),
    placeholderData: keepPreviousData,
  });
}

/**
 * A pre-signed link for previewing or downloading a document. Links expire after a few
 * minutes, so they are cached only briefly and never reused across disposition types.
 */
export function useDocumentLink(docId: string | null, disposition: DownloadDisposition) {
  return useQuery({
    queryKey: queryKeys.documentLink(docId ?? '', disposition),
    queryFn: () => api.get<DocumentDownload>(`/documents/${docId}?disposition=${disposition}`),
    enabled: docId !== null,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });
}

export function useSavePassport(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PassportRequest) =>
      id ? api.put<PassportDto>(`/passports/${id}`, body) : api.post<PassportDto>('/passports', body),
    onSuccess: (passport) => {
      queryClient.setQueryData(queryKeys.passport(passport.id), passport);
      void queryClient.invalidateQueries({ queryKey: ['passports'] });
    },
  });
}

export function useDeletePassport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/passports/${id}`),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: queryKeys.passport(id) });
      void queryClient.invalidateQueries({ queryKey: ['passports'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, changes }: { docId: string; changes: UpdateDocumentInput }) =>
      api.put<DocumentDto>(`/documents/${docId}`, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api.delete<{ docId: string }>(`/documents/${docId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

/** Requests a short-lived pre-signed URL and starts the download. */
export async function downloadDocument(docId: string): Promise<void> {
  const { downloadUrl } = await api.get<DocumentDownload>(`/documents/${docId}`);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
