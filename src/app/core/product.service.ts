import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:8081/products';
const SEARCH_URL = 'http://localhost:8081/products/search';

export interface ProductCategory { id: number; name?: string; }
export interface ProductDTO {
  id?: number;
  name: string;
  description: string;
  price: number;
  quantity: number | string;
  category: ProductCategory;
  brand: string;
  status: string;
  image?: string; // base64 image string
}

interface ApiListResponse { data: ProductDTO[]; message?: string; }
interface ApiItemResponse { data: ProductDTO; message?: string; }

@Injectable({ providedIn: 'root' })
export class ProductService {
  loading = signal(false);
  constructor(private http: HttpClient) {}

  async list(): Promise<ProductDTO[]> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<ApiListResponse>(`${API_URL}/list`));
      return res?.data || [];
    } finally { this.loading.set(false); }
  }

  async get(id: number): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.get<ApiItemResponse>(`${API_URL}/${id}`));
    return res?.data || null;
  }

  async create(p: ProductDTO): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.post<ApiItemResponse>(`${API_URL}/create`, p));
    return res?.data || null;
  }

  async update(p: ProductDTO): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.put<ApiItemResponse>(`${API_URL}/update`, p));
    return res?.data || null;
  }

  async remove(id: number): Promise<boolean> {
    const res = await firstValueFrom(this.http.delete<ApiItemResponse>(`${API_URL}/${id}`));
    return !!res?.data;
  }

  async search(name: string, page = 0, size = 10): Promise<ProductDTO[]> {
    const q = (name || '').trim();
    if(!q) return [];
    this.loading.set(true);
    try {
      // Backend may return either { data: ProductDTO[] } or ProductDTO[] directly
      const res: any = await firstValueFrom(this.http.get<any>(`${SEARCH_URL}`, { params: { name: q, page, size } as any }));
      if (Array.isArray(res)) return res as ProductDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as ProductDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as ProductDTO[];
      }
      return [];
    } finally { this.loading.set(false); }
  }
}
