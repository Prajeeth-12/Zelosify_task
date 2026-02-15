import { fetchRequestData as fetchRequestDataImpl } from "./requests/getVendorRequests.js";
// import { updateVendorRequest as updateVendorRequestImpl } from "./requests/updateVendorRequest.js";
// import { generatePresignedUrls as generatePresignedUrlsImpl } from "./attachment/generatePresignedUrls.js";
// import { uploadAttachment as uploadAttachmentImpl } from "./attachment/uploadAttachment.js";
import { Response } from "express";
import type { AuthenticatedRequest } from "../../../types/common.js";

/**
 * Handles vendor requests with error handling and response formatting.
 * Uses AuthenticatedRequest to ensure tenant context is available.
 * @param req Authenticated Express request (must include req.user.tenant.tenantId)
 * @param res Express response
 */
export const fetchRequestData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await fetchRequestDataImpl(req, res);
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Internal server error",
      details: (error as Error).message,
    });
  }
};

// export const updateVendorRequest = async (req: Request, res: Response) => {
//   try {
//     await updateVendorRequestImpl(req, res);
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       error: "Internal server error",
//       details: (error as Error).message,
//     });
//   }
// };

// export const generatePresignedUrls = async (req: Request, res: Response) => {
//   try {
//     await generatePresignedUrlsImpl(req, res);
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       error: "Internal server error",
//       details: (error as Error).message,
//     });
//   }
// };

// export const uploadAttachment = async (req: Request, res: Response) => {
//   try {
//     await uploadAttachmentImpl(req, res);
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       error: "Internal server error",
//       details: (error as Error).message,
//     });
//   }
// };
