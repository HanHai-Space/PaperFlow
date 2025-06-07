// Google Drive API 集成模块 - 使用REST API
import { Settings } from '@/types/pdf-processor';

export interface GoogleDriveUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  error?: string;
}

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  folderId?: string;
}

export class GoogleDriveService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isAuthenticated: boolean = false;
  private config: GoogleDriveConfig;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  /**
   * 获取授权URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      scope: scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * 使用授权码设置访问令牌
   */
  async setAuthCode(code: string): Promise<boolean> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokens = await response.json();
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.isAuthenticated = true;

      // 保存令牌到本地存储
      this.saveTokens(tokens);

      return true;
    } catch (error) {
      console.error('Failed to set auth code:', error);
      return false;
    }
  }

  /**
   * 从本地存储加载令牌
   */
  loadTokens(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const tokens = localStorage.getItem('googleDriveTokens');
      if (tokens) {
        const parsedTokens = JSON.parse(tokens);
        this.accessToken = parsedTokens.access_token;
        this.refreshToken = parsedTokens.refresh_token;
        this.isAuthenticated = true;
        return true;
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
    return false;
  }

  /**
   * 保存令牌到本地存储
   */
  private saveTokens(tokens: any): void {
    try {
      localStorage.setItem('googleDriveTokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  /**
   * 检查是否已认证
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * 刷新访问令牌
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('No refresh token available');
      return false;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token refresh failed:', errorText);
        return false;
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // 保存更新后的令牌（包括新的访问令牌和现有的刷新令牌）
      const updatedTokens = {
        access_token: data.access_token,
        refresh_token: this.refreshToken,
        // 如果响应中包含新的刷新令牌，使用它
        ...(data.refresh_token && { refresh_token: data.refresh_token })
      };
      this.saveTokens(updatedTokens);

      console.log('Access token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  /**
   * 执行带有自动令牌刷新的API请求
   */
  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // 设置Authorization头
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`,
    };

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // 如果收到401错误，尝试刷新令牌并重试
    if (response.status === 401) {
      console.log('Received 401, attempting to refresh token...');
      const refreshed = await this.refreshAccessToken();

      if (refreshed) {
        // 使用新令牌重试请求
        const newHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${this.accessToken}`,
        };

        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      }
    }

    return response;
  }

  /**
   * 确保文件夹存在，如果不存在则创建
   */
  private async ensureFolderExists(folderIdOrName: string): Promise<string> {
    try {
      // 首先尝试作为文件夹ID查找
      const checkResponse = await this.makeAuthenticatedRequest(`https://www.googleapis.com/drive/v3/files/${folderIdOrName}?fields=id,name,mimeType`);

      if (checkResponse.ok) {
        const folder = await checkResponse.json();
        if (folder.mimeType === 'application/vnd.google-apps.folder') {
          console.log(`Folder exists: ${folder.name} (${folder.id})`);
          return folder.id;
        }
      }

      // 如果作为ID查找失败，尝试作为文件夹名称搜索
      console.log(`Folder ID ${folderIdOrName} not found, searching by name...`);
      const searchResponse = await this.makeAuthenticatedRequest(`https://www.googleapis.com/drive/v3/files?q=name='${folderIdOrName}' and mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`);

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        if (searchResult.files && searchResult.files.length > 0) {
          const existingFolder = searchResult.files[0];
          console.log(`Found existing folder by name: ${existingFolder.name} (${existingFolder.id})`);
          return existingFolder.id;
        }
      }

      // 如果文件夹不存在，创建新文件夹
      console.log(`Creating new folder: ${folderIdOrName}`);
      const createResponse = await this.makeAuthenticatedRequest('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderIdOrName,
          mimeType: 'application/vnd.google-apps.folder'
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create folder:', errorText);
        throw new Error(`Failed to create folder: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
      }

      const newFolder = await createResponse.json();
      console.log(`Created new folder: ${newFolder.name} (${newFolder.id})`);
      return newFolder.id;

    } catch (error) {
      console.error('Error ensuring folder exists:', error);
      // 如果文件夹操作失败，返回null，文件将上传到根目录
      return '';
    }
  }

  /**
   * 上传文件到Google Drive
   */
  async uploadFile(
    fileData: Uint8Array | Buffer,
    fileName: string,
    folderId?: string
  ): Promise<GoogleDriveUploadResult> {
    if (!this.isAuthenticated || !this.accessToken) {
      return {
        success: false,
        error: 'Not authenticated with Google Drive'
      };
    }

    try {
      console.log('Starting Google Drive upload:', {
        fileName,
        fileSize: fileData.length,
        folderId,
        accessTokenLength: this.accessToken?.length
      });

      // 处理文件夹ID，如果不存在则创建
      let actualFolderId = folderId;
      if (folderId) {
        actualFolderId = await this.ensureFolderExists(folderId);
      }

      // 创建文件元数据
      const fileMetadata: any = {
        name: fileName,
      };

      // 如果指定了文件夹ID，设置父文件夹
      if (actualFolderId) {
        fileMetadata.parents = [actualFolderId];
      }

      console.log('File metadata:', fileMetadata);

      // 使用简单上传而不是multipart上传，这样更可靠
      console.log('Using simple upload method...');

      // 首先创建文件元数据
      const metadataResponse = await this.makeAuthenticatedRequest('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileMetadata),
      });

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text();
        console.error('Metadata creation failed:', errorText);
        throw new Error(`Metadata creation failed: ${metadataResponse.status} ${metadataResponse.statusText} - ${errorText}`);
      }

      const createdFile = await metadataResponse.json();
      console.log('File metadata created:', createdFile);

      // 然后上传文件内容
      const uploadResponse = await this.makeAuthenticatedRequest(`https://www.googleapis.com/upload/drive/v3/files/${createdFile.id}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: fileData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('File upload failed:', errorText);
        throw new Error(`File upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      // 获取最终的文件信息（包括webViewLink）
      const finalResponse = await this.makeAuthenticatedRequest(`https://www.googleapis.com/drive/v3/files/${createdFile.id}?fields=id,name,webViewLink`);

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error('Failed to get file info:', errorText);
        // 即使获取文件信息失败，上传已经成功了
        return {
          success: true,
          fileId: createdFile.id,
          fileName: createdFile.name,
          webViewLink: `https://drive.google.com/file/d/${createdFile.id}/view`,
        };
      }

      const finalFile = await finalResponse.json();
      console.log('Upload completed successfully:', finalFile);

      return {
        success: true,
        fileId: finalFile.id,
        fileName: finalFile.name,
        webViewLink: finalFile.webViewLink || `https://drive.google.com/file/d/${finalFile.id}/view`,
      };
    } catch (error) {
      console.error('Failed to upload file to Google Drive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.isAuthenticated || !this.accessToken) {
      return false;
    }

    try {
      const response = await this.makeAuthenticatedRequest('https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)');
      return response.ok;
    } catch (error) {
      console.error('Google Drive connection test failed:', error);
      return false;
    }
  }

  /**
   * 清除认证信息
   */
  clearAuth(): void {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('googleDriveTokens');
  }
}

/**
 * 创建Google Drive服务实例
 */
export function createGoogleDriveService(settings: Settings): GoogleDriveService | null {
  if (!settings.enableGoogleDrive || !settings.googleDriveClientId || !settings.googleDriveClientSecret) {
    return null;
  }

  const config: GoogleDriveConfig = {
    clientId: settings.googleDriveClientId,
    clientSecret: settings.googleDriveClientSecret,
    folderId: settings.googleDriveFolderId || undefined,
  };

  const service = new GoogleDriveService(config);

  // 尝试加载已保存的令牌
  service.loadTokens();

  return service;
}

/**
 * 上传ZIP文件到Google Drive
 */
export async function uploadZipToGoogleDrive(
  zipData: Uint8Array,
  fileName: string,
  settings: Settings
): Promise<GoogleDriveUploadResult> {
  try {
    console.log('Starting Google Drive upload:', {
      fileName,
      fileSize: zipData.length,
      enableGoogleDrive: settings.enableGoogleDrive,
      googleDriveAutoUpload: settings.googleDriveAutoUpload,
      hasClientId: !!settings.googleDriveClientId,
      hasClientSecret: !!settings.googleDriveClientSecret,
      folderId: settings.googleDriveFolderId
    });

    const service = createGoogleDriveService(settings);

    if (!service) {
      console.error('Google Drive service creation failed');
      return {
        success: false,
        error: 'Google Drive not configured'
      };
    }

    if (!service.isAuth()) {
      console.error('Google Drive not authenticated');
      return {
        success: false,
        error: 'Google Drive not authenticated'
      };
    }

    console.log('Google Drive service ready, starting upload...');
    const result = await service.uploadFile(
      zipData,
      fileName,
      settings.googleDriveFolderId || undefined
    );

    console.log('Google Drive upload result:', result);
    return result;
  } catch (error) {
    console.error('Google Drive upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
