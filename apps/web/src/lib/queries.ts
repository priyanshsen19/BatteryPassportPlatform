'use client';

import type {
  AuthUser,
  DocumentDownload,
  DocumentDto,
  Paginated,
  PassportDto,
  PassportRequest,
  UpdateDocumentInput,
} from '@bpp/shared/schemas';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, parseResponse } from './api-client';

export const queryKeys = {
  session: ['session'] as const,
  passports: (page: number, limit: number) => ['passports', { page, limit }] as const,
  passport: (id: string) => ['passport', id] as const,
  documents: (filter: { passportId?: string; page: number; limit: number }) => ['documents', filter] as const,
};

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () =>
      (await parseResponse<{ user: AuthUser }>(await fetch('/api/auth/session', { cache: 'no-store' }))).user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsAdmin(): boolean {
  return useSession().data?.role === 'admin';
}

export function usePassports(page: number, limit = 20) {
  return useQuery({
    queryKey: queryKeys.passports(page, limit),
    queryFn: () => api.get<Paginated<PassportDto>>(`/passports?page=${page}&limit=${limit}`),
    placeholderData: keepPreviousData,
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
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter.passportId) params.set('passportId', filter.passportId);

  return useQuery({
    queryKey: queryKeys.documents({ passportId: filter.passportId, page, limit }),
    queryFn: () => api.get<Paginated<DocumentDto>>(`/documents?${params}`),
    placeholderData: keepPreviousData,
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
